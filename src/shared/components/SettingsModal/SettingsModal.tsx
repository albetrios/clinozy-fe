import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ORGANIZATION } from '@/core/config/constants.ts';
import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useAccessResolved } from '@/shared/hooks/useCan/index.ts';
import { useDeploymentFlags } from '@/shared/hooks/useDeploymentFlags/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  SETTINGS_KEYS,
  SETTINGS_NS,
  SETTINGS_SECTION_LABEL_KEYS,
} from './settings.constants.ts';
import { SettingsDirtyProvider, useSettingsDirty } from './settings-dirty.tsx';
import {
  isCanonicalSettingsHash,
  isSettingsHash,
  parseSettingsHash,
  settingsHash,
} from './settings-hash.ts';
import {
  firstVisibleSettingsSection,
  visibleSettingsNavGroups,
} from './settings-nav-visibility.ts';
import { resolveSettingsSection } from './settings-resolve.ts';
import {
  SETTINGS_SCOPE_TONES,
  SettingsSectionContext,
} from './settings-section-context.ts';
import type {
  SettingsScope,
  SettingsSection,
  SettingsSectionRef,
} from './settings-sections.ts';
import { SettingsNav } from './SettingsNav.tsx';
import { SectionHeader } from './SettingsPanelShell.tsx';

/**
 * Global settings drawer — ONE drawer for account + organization settings,
 * driven by the URL hash (`#settings/<scope>/<section>`), mounted once on the
 * root route so it overlays any page without unmounting it. Deep links
 * reproduce page + drawer, refresh keeps the section, back/Esc closes.
 *
 * Route guards never see hashes: auth, organization-context, and permission
 * gating all happen here (settings-permissions.ts). routing-and-tenancy.md §7.
 */
export function SettingsModal() {
  return (
    <SettingsDirtyProvider>
      <SettingsModalBody />
    </SettingsDirtyProvider>
  );
}

/**
 * The drawer's width from `md`: the widest record drawer, so the rail
 * (220–264px) and a section's page sit side by side as the Users room's
 * master–detail split does. Below `md` the drawer is the full screen.
 */
const SETTINGS_DRAWER_WIDTH = 1040;

/**
 * Which settings section to show, and which nav groups exist yet: derived from the URL hash, the
 * session, the active organization, and whether me/context and the permission set have answered.
 * Also keeps the hash canonical and reports each section view.
 */
function useSettingsSection() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const permissions = useOrganizationStore((s) => s.permissions);
  // Active org type (PERSONAL/TEAM) drives which org sections EXIST — so until
  // me/context answers, the shape of this modal is unknown. Read the whole
  // query, not just its data: `undefined` is "still loading", and treating it
  // as "everything is allowed" is what made the Organization group appear and
  // then vanish, and a deep link open the members panel and then swap itself
  // for a fallback (SET-15).
  const meContext = useMeContext();
  const orgType = meContext.data?.activeOrganization?.type;
  // The OTHER half of "do we know the shape of this modal yet": which sections
  // the user may open comes from the org store's permission set, and entering an
  // organization clears that set (`ensurePermissionsFor` → `clearPermissions()`)
  // a beat before the real one lands. For that beat `permissions` is `[]` —
  // which means "not known yet", not "you may do nothing" (SET-23; it is what
  // `useAccessResolved` exists to tell apart). Reading it as an answer hid the
  // Organization group, resolved `#settings/organization/general` to the
  // fallback, and let the effect below REWRITE THE URL to `account/profile` —
  // permanently, 19 ms after the deep link and ~50 ms before the permissions
  // arrived. me/context was already correct (`TEAM`) the whole time.
  const accessResolved = useAccessResolved();
  // …unless there is nothing to wait for. The permission set is DERIVED from
  // me/context (`deriveOrgContext`), so when that settled without data — a failed
  // fetch — no answer is ever coming: do not hang on the skeleton, fall back to
  // permission-only gating with whatever the store holds, as the modal always has.
  const contextReady = !meContext.isPending && (accessResolved || !meContext.data);
  const deploymentFlags = useDeploymentFlags();
  const navigate = useNavigate();

  const parsed = isAuthenticated ? parseSettingsHash(hash) : null;
  const hasOrganizationContext =
    !!organizationId && organizationId !== ORGANIZATION.LOCALHOST_FALLBACK;
  const navCtx = useMemo(
    () => ({
      hasOrganizationContext,
      orgType,
      teamOrganizations: deploymentFlags.teamOrganizations,
      role: user?.role ?? ('user' as const),
      permissions,
    }),
    [
      deploymentFlags.teamOrganizations,
      hasOrganizationContext,
      orgType,
      permissions,
      user?.role,
    ],
  );
  const visibleGroups = useMemo(() => visibleSettingsNavGroups(navCtx), [navCtx]);
  const readyGroups = contextReady
    ? visibleGroups
    : visibleGroups.filter((group) => group.scope === 'account');
  const fallbackSection = useMemo(
    () => firstVisibleSettingsSection(visibleGroups),
    [visibleGroups],
  );
  const active =
    parsed && contextReady
      ? resolveSettingsSection(parsed, navCtx, fallbackSection)
      : parsed;
  const scope = active?.scope;
  const section = active?.section;

  useLayoutEffect(() => {
    if (!(contextReady && active && isSettingsHash(hash))) return;
    if (isCanonicalSettingsHash(hash, active)) return;
    void navigate({
      to: '.',
      hash: settingsHash(active.scope, active.section),
      search: (prev) => prev,
      replace: true,
    });
  }, [active, contextReady, hash, navigate]);

  // Hash changes are invisible to pageview analytics — emit explicitly.
  useEffect(() => {
    if (scope && section) {
      captureAnalyticsEvent(ANALYTICS_EVENTS.settingsSectionViewed, { scope, section });
    }
  }, [scope, section]);

  return { active, readyGroups, contextReady };
}

/**
 * Mobile section switch — the rail is hidden below `md`, where the drawer is
 * the full screen, so a phone picks the section from the shared Picker (its
 * 72% bottom sheet), as the phone list toolbars pick: a 44px trigger, each row
 * the section's icon tile, the two scopes as groups. `px-4` is the content
 * pane's gutter, so the switch and the fields under it share their edges; the
 * drawer's × sits in its header above, so nothing here makes room for it.
 */
function MobileSectionPicker({
  groups,
  active,
  onSelect,
}: {
  groups: ReturnType<typeof visibleSettingsNavGroups>;
  active: SettingsSectionRef;
  onSelect: (next: SettingsSectionRef) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const options = groups.flatMap((group) =>
    group.items.map((item) => ({
      key: `${item.scope}/${item.section}`,
      label: t(item.labelKey),
      group: t(group.labelKey),
      groupTone: SETTINGS_SCOPE_TONES[group.scope],
      tone: SETTINGS_SCOPE_TONES[item.scope],
      leading: { kind: 'icon' as const, icon: item.icon },
      keywords: item.keywords,
    })),
  );
  return (
    <div className="shrink-0 border-b px-4 py-2 md:hidden">
      <Picker
        label={t(SETTINGS_KEYS.nav.ariaSections)}
        value={`${active.scope}/${active.section}`}
        options={options}
        plain
        size="lg"
        placeholder={t(SETTINGS_SECTION_LABEL_KEYS[active.section])}
        onChange={(key) => {
          if (!key) return;
          const [scope, section] = key.split('/') as [SettingsScope, SettingsSection];
          onSelect({ scope, section });
        }}
        testId="settings-mobile-section"
        className="w-full"
      />
    </div>
  );
}

/** The discard prompt's test ids (`settings-discard-*`, as the Settings specs name them). */
const SETTINGS_DISCARD_TEST_IDS = {
  dialog: 'settings-discard-dialog',
  cancel: 'settings-discard-stay',
  accept: 'settings-discard-leave',
} as const;

function SettingsModalBody() {
  const { t } = useTranslation(SETTINGS_NS);
  // The shell stays mounted while panels load or change sections.
  const { active, readyGroups, contextReady } = useSettingsSection();
  const isDirty = useSettingsDirty()?.isDirty ?? false;
  // A guarded action (close, a section switch, Back) meets a dirty panel: the
  // shared "Discard changes?" prompt — with the ids the Settings specs know.
  const { guardDialog, confirmDiscard } = useUnsavedChangesGuard({
    when: isDirty,
    testIds: SETTINGS_DISCARD_TEST_IDS,
  });
  const navigate = useNavigate();
  const router = useRouter();

  const close = useCallback(() => {
    if (router.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: '.', hash: '', search: (prev) => prev, replace: true });
    }
  }, [navigate, router]);

  if (!active) return null;

  const guardedClose = () => confirmDiscard(close);

  // Section switches replace the history entry so a single Back closes the
  // modal from anywhere instead of replaying every visited section.
  const goTo = (next: SettingsSectionRef) => {
    confirmDiscard(() => {
      void navigate({
        to: '.',
        hash: settingsHash(next.scope, next.section),
        search: (prev) => prev,
        replace: true,
      });
    });
  };

  // The record drawer's frame (header, floating ×, full screen on a phone); the
  // body is Settings' own two panes, and every section saves itself, so there
  // is no footer. Its dirty guard is the one above — with the ids the Settings
  // specs know, and covering section switches too — so the drawer is handed
  // the guarded close rather than a `dirty` flag of its own. A press on a toast
  // is not an outside press: the toaster sits in the layer's branch.
  return (
    <>
      <RecordDrawer
        open
        onClose={guardedClose}
        title={t(SETTINGS_KEYS.dialog.title)}
        width={SETTINGS_DRAWER_WIDTH}
        flushBody
        hideFooter
        testId="settings-modal"
      >
        {/* The Users room's master–detail split (`users.md:19`; H:1117): the
            rail on `canvas`, minmax(220px, 264px), and the section's page
            scrolling on its own beside it. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(220px,264px)_minmax(0,1fr)]">
          <SettingsNav groups={readyGroups} active={active} onSelect={goTo} />
          <div className="flex min-h-0 flex-col">
            <MobileSectionPicker groups={readyGroups} active={active} onSelect={goTo} />
            <div
              // `sm:px-6` / `sm:pb-6`: the standard pane inset. No top inset:
              // each section's head row is the pane's header, pinned to its top
              // while the panel scrolls beneath it (`SectionHeader`).
              className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6 sm:pb-6"
              data-testid="settings-content"
            >
              <SettingsSectionContext value={active}>
                {contextReady ? (
                  <ActivePanel
                    key={`${active.scope}/${active.section}`}
                    active={active}
                  />
                ) : (
                  <SettingsContentLoading active={active} />
                )}
              </SettingsSectionContext>
            </div>
          </div>
        </div>
      </RecordDrawer>

      {guardDialog}
    </>
  );
}

const PANEL_LOADERS = {
  profile: onceAsync(() =>
    import('./account/AccountProfilePanel.tsx').then((m) => ({
      default: m.AccountProfilePanel,
    })),
  ),
  account: onceAsync(() =>
    import('./account/AccountPanel.tsx').then((m) => ({ default: m.AccountPanel })),
  ),
  security: onceAsync(() =>
    import('./account/AccountSecurityPanel.tsx').then((m) => ({
      default: m.AccountSecurityPanel,
    })),
  ),
  notifications: onceAsync(() =>
    import('./account/AccountNotificationsPanel.tsx').then((m) => ({
      default: m.AccountNotificationsPanel,
    })),
  ),
  sessions: onceAsync(() =>
    import('./account/AccountSessionsPanel.tsx').then((m) => ({
      default: m.AccountSessionsPanel,
    })),
  ),
  billing: onceAsync(() =>
    import('./account/AccountBillingPanel.tsx').then((m) => ({
      default: m.AccountBillingPanel,
    })),
  ),
  general: onceAsync(() =>
    import('./organization/OrganizationGeneralPanel.tsx').then((m) => ({
      default: m.OrganizationGeneralPanel,
    })),
  ),
  clinic: onceAsync(() =>
    import('./organization/OrganizationClinicPanel.tsx').then((m) => ({
      default: m.OrganizationClinicPanel,
    })),
  ),
  members: onceAsync(() =>
    import('./organization/OrganizationMembersPanel.tsx').then((m) => ({
      default: m.OrganizationMembersPanel,
    })),
  ),
  roles: onceAsync(() =>
    import('./organization/OrganizationRolesPanel.tsx').then((m) => ({
      default: m.OrganizationRolesPanel,
    })),
  ),
  integrations: onceAsync(() =>
    import('./organization/OrganizationIntegrationsPanel.tsx').then((m) => ({
      default: m.OrganizationIntegrationsPanel,
    })),
  ),
};

function SettingsContentLoading({ active }: { active: SettingsSectionRef }) {
  const { t } = useTranslation(SETTINGS_NS);
  const sectionLabel = t(SETTINGS_SECTION_LABEL_KEYS[active.section]);
  // The header names the section; the skeleton below is the SAME component every
  // panel draws while its own query resolves, so the shell-to-panel handoff
  // swaps identical markup instead of one skeleton shape for another.
  return (
    <div className="flex flex-col gap-4" data-testid="settings-content-loading">
      <SectionHeader title={sectionLabel} />
      {/* No width override here. The panel below draws the SAME component when its
          own query resolves, so any difference between the two — a max-width, a
          gap — makes the handoff look like a second skeleton replacing the first,
          which is exactly what this was meant to stop. */}
      <PanelSkeleton name={sectionLabel} />
    </div>
  );
}

function ActivePanel({ active }: { active: SettingsSectionRef }) {
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const { Component: Panel, retry } = useRetryableLazy(PANEL_LOADERS[active.section]);
  const sectionLabel = tSettings(
    SETTINGS_SECTION_LABEL_KEYS[
      active.section as keyof typeof SETTINGS_SECTION_LABEL_KEYS
    ],
  );

  return (
    <SectionErrorBoundary
      title={sectionLabel}
      testId={`settings-panel-error-${active.section}`}
      onReset={retry}
    >
      <Suspense fallback={<SettingsContentLoading active={active} />}>
        <Panel />
      </Suspense>
    </SectionErrorBoundary>
  );
}
