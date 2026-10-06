import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ORGANIZATION } from '@/core/config/constants.ts';
import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { useEnterAnimationProps } from '@/shared/components/LazyOverlay/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog.tsx';
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
 * Global settings modal — ONE modal for account + organization settings,
 * driven by the URL hash (`#settings/<scope>/<section>`), mounted once on the
 * root route so it overlays any page without unmounting it. Deep links
 * reproduce page + modal, refresh keeps the section, back/Esc closes.
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
 * One dialog shell for both the loading and the resolved states: a full-screen
 * sheet on phones (square — it IS the screen), a dialog from `sm`, in the
 * design's centred-dialog frame (12px corners, the command menu's).
 *
 * The `sm:` half has to undo the sheet, not just cap it: `w-full` with only a
 * `max-w` left the modal flush against both edges on anything between 640px and
 * 960px (every tablet), and an unconditional `rounded-none` kept it square on
 * desktop under every radius setting. `sm:rounded-xl` is token-backed and the
 * dialog slot squares it again under the Sharp shape.
 */
const SETTINGS_DIALOG_CLASS =
  'h-dvh max-h-dvh w-full max-w-full gap-0 overflow-hidden rounded-none p-0 ' +
  'sm:h-[640px] sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-[960px] sm:rounded-xl ' +
  '3xl:h-[760px] 3xl:max-w-[1120px]';

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
 * Mobile section switch — the rail is hidden below `sm`, so a phone picks the
 * section from the shared Picker (its 72% bottom sheet), as the phone list
 * toolbars pick: a 44px trigger, each row the section's icon tile, the two
 * scopes as groups. `ps-4` is the content pane's gutter, so the switch and the
 * fields under it share a left edge.
 *
 * `pe-14` reserves room for the dialog's close button, which is pinned on the
 * logical end too (`ui/dialog.tsx`) — so the two mirror together. They did
 * not: the button was physical (`right-4`) while this inset was logical, which
 * put them on opposite sides in Arabic and Hebrew and ran the picker under the
 * X. 14 rather than 12: the button is 32px wide inset 16px, so 48px of
 * reservation left the picker flush against the X with nothing between them;
 * 56px keeps the pane's own 16px gutter between the two (QA-V3 suggestion 7).
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
    <div className="shrink-0 border-b py-2 ps-4 pe-14 sm:hidden">
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
  const enterProps = useEnterAnimationProps();
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

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && guardedClose()}>
        <DialogContent
          className={SETTINGS_DIALOG_CLASS}
          data-testid="settings-modal"
          {...enterProps}
          onInteractOutside={(e) => {
            // Toasts render outside the dialog (sonner) — clicking one (e.g. its
            // close button) must dismiss the toast, not close Settings.
            const node = e.detail.originalEvent.target as Element | null;
            if (node?.closest('[data-sonner-toaster]')) e.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">{t(SETTINGS_KEYS.dialog.title)}</DialogTitle>
          {/* The Users room's master–detail split (`users.md:19`; H:1117): the
              rail on `canvas`, minmax(220px, 264px), and the section's page
              scrolling on its own beside it. */}
          <div className="grid h-full min-h-0 grid-cols-1 sm:grid-cols-[minmax(220px,264px)_minmax(0,1fr)]">
            <SettingsNav groups={readyGroups} active={active} onSelect={goTo} />
            <div className="flex min-h-0 flex-col">
              <MobileSectionPicker groups={readyGroups} active={active} onSelect={goTo} />
              <div
                // `sm:px-6` / `sm:pb-6`: the standard dialog inset. No top inset:
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
        </DialogContent>
      </Dialog>

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
