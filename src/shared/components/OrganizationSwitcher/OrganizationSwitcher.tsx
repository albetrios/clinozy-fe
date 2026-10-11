import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationHome, organizationPicker } from '@/lib/routes/index.ts';
import { cn } from '@/lib/utils.ts';
import { CountBadge } from '@/shared/components/Cells/CountBadge/index.ts';
import { CreateOrganizationDialog } from '@/shared/components/CreateOrganizationDialog/index.ts';
import { Spinner } from '@/shared/components/Spinner/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { mapApiError, reportError } from '@/shared/errors/errorHandler.ts';
import { useDeploymentFlags } from '@/shared/hooks/useDeploymentFlags/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { Check, ChevronsUpDown, Plus } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useWorkspaceSwitchStore } from '@/shared/store/useWorkspaceSwitchStore/index.ts';
import {
  resolveDeploymentMode,
  shouldAllowCreateTeam,
  shouldShowOrganizationSwitcher,
} from '@/shared/tenancy/deployment-mode.ts';
import type { OrganizationSummary } from '@/shared/tenancy/me-context.ts';
import { type MyInvitation, useMyInvitations } from '@/shared/tenancy/my-invitations.ts';
import { useMyOrganizationSummaries } from '@/shared/tenancy/my-organization-summaries.ts';
import { switchToPersonal } from '@/shared/tenancy/switch.ts';

interface OrganizationSwitcherProps {
  /** Extra classes for the trigger button. */
  className?: string;
  /** Dropdown alignment relative to the trigger. */
  align?: 'start' | 'end';
  /**
   * `submenu` renders the switcher as a row inside a parent dropdown — the
   * section-bar Account menu's "Switch clinic" (KICKOFF §3.2) — instead of its
   * own trigger and menu. It lists the workspaces only (no "Add"), and hides
   * when there is nothing to switch to.
   */
  presentation?: 'menu' | 'submenu';
  /** The submenu row's label (`presentation: 'submenu'`). */
  submenuLabel?: string;
  /** Called once a switch has landed — a parent menu closes itself. */
  onSwitched?: () => void;
}

/**
 * Stable id for the switch-failed toast (house rule 7). Switching is a repeat-fire
 * control — a user whose first attempt failed will press again — so the second
 * failure must REPLACE the first message rather than stack another copy of it.
 */
export const ORG_SWITCH_TOAST_ID = 'organization-switch-failed';

function initialOf(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

/**
 * What the trigger says about the active organization: its initial in a small
 * chip, then its name, on one line.
 */
function TriggerIdentity({ name }: { name: string }) {
  return (
    <>
      <span
        // `icon-chip`, not a bare `rounded`: the chip follows the radius and
        // shape axes (square under Sharp) like every other tile.
        data-slot="icon-chip"
        className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center text-xs font-semibold"
      >
        {initialOf(name)}
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm leading-5 font-medium">{name}</span>
      </span>
    </>
  );
}

/**
 * One organization in the menu: its initial — or a spinner while a switch to it is in flight —
 * name, slug, and a check on the active one.
 */
function OrganizationOption({
  org,
  isActive,
  isSwitching,
  isDisabled,
  onChoose,
}: {
  org: OrganizationSummary;
  isActive: boolean;
  isSwitching: boolean;
  isDisabled: boolean;
  onChoose: (org: OrganizationSummary) => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // Re-picking the active org is a no-op — let Radix close the menu.
        if (isActive) return;
        // Otherwise KEEP THE MENU OPEN. Radix closes on select, which is what
        // made a switch look like nothing at all: the menu vanished and the
        // screen sat unchanged for a round trip. Held open, this row is the
        // progress indicator — and a failure has somewhere to land other than a
        // screen the user has already been handed back.
        event.preventDefault();
        onChoose(org);
      }}
      disabled={isDisabled}
      data-testid={`organization-switcher-option-${org.slug ?? 'personal'}`}
      className="gap-2"
    >
      <span
        data-slot="icon-chip"
        className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center text-xs font-semibold"
      >
        {isSwitching ? (
          <Spinner data-testid="organization-switcher-option-spinner" />
        ) : (
          initialOf(org.name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{org.name}</span>
        {org.slug ? (
          <span className="text-muted-foreground block truncate text-xs">{org.slug}</span>
        ) : null}
      </span>
      {isActive ? (
        <Check className="text-primary ms-auto size-4 shrink-0" aria-hidden />
      ) : null}
    </DropdownMenuItem>
  );
}

/**
 * One pending invitation in the menu (D84): the clinic's initial and name, "Invited · <roles>".
 * Choosing it opens the organization picker, where it is accepted or declined.
 */
function InvitedOption({
  invitation,
  onChoose,
}: {
  invitation: MyInvitation;
  onChoose: () => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const { name } = invitation.organization;
  return (
    <DropdownMenuItem
      onSelect={onChoose}
      data-testid={`organization-switcher-invitation-${invitation.id}`}
      className="gap-2"
    >
      <span
        data-slot="icon-chip"
        className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center text-xs font-semibold"
      >
        {initialOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {t(LAYOUT_KEYS.app.orgSwitcher.invitedRow, {
            roles: invitation.roleNames.join(', '),
          })}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

/** The menu's body: the personal section (when there is one), the organizations, and "Add". */
function OrganizationMenuSections({
  personalOptions,
  teamOptions,
  invitedOptions,
  teamOnly,
  showCreateTeam,
  onCreate,
}: {
  personalOptions: ReactNode[];
  teamOptions: ReactNode[];
  /** The pending invitations (D84), listed first so they are seen. */
  invitedOptions: ReactNode[];
  teamOnly: boolean;
  showCreateTeam: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <>
      {invitedOptions.length > 0 ? (
        <>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            {t(LAYOUT_KEYS.app.orgSwitcher.invited)}
          </DropdownMenuLabel>
          {invitedOptions}
          <DropdownMenuSeparator />
        </>
      ) : null}
      {personalOptions.length > 0 ? (
        <>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            {t(LAYOUT_KEYS.app.orgSwitcher.personal)}
          </DropdownMenuLabel>
          {personalOptions}
          <DropdownMenuSeparator />
        </>
      ) : null}

      <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
        {teamOnly
          ? t(LAYOUT_KEYS.app.orgSwitcher.yourOrganizations)
          : t(LAYOUT_KEYS.app.orgSwitcher.organizations)}
      </DropdownMenuLabel>
      {teamOptions}
      {showCreateTeam ? (
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onCreate();
          }}
          data-testid="organization-switcher-create"
        >
          <Plus className="me-2 h-4 w-4" />
          {t(LAYOUT_KEYS.app.orgSwitcher.addOrganization)}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

/** The switcher as a row inside a parent menu: its label, the active name, the list beside it. */
function OrganizationSubmenu({
  open,
  onOpenChange,
  label,
  activeName,
  busy,
  invitationCount,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string | undefined;
  activeName: string;
  busy: boolean;
  /** Pending invitations (D84): a count beside the label while there are any. */
  invitationCount: number;
  children: ReactNode;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  return (
    <DropdownMenuSub open={open} onOpenChange={onOpenChange}>
      <DropdownMenuSubTrigger
        className="text-body h-9 gap-2.5 rounded-lg px-2.5 font-medium"
        disabled={busy}
        aria-busy={busy}
        data-testid="organization-switcher-trigger"
        data-layout="submenu"
      >
        {/* The label keeps its width; the clinic name gives way to the invitation count. */}
        <span className="shrink-0 whitespace-nowrap">{label}</span>
        {invitationCount > 0 ? (
          <CountBadge
            count={invitationCount}
            srLabel={t(LAYOUT_KEYS.app.orgSwitcher.invitationCount, {
              count: invitationCount,
            })}
            data-testid="organization-switcher-invitation-count"
          />
        ) : null}
        <span className="text-muted-foreground text-caption ms-auto max-w-28 min-w-0 truncate">
          {activeName}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">{children}</DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * The switch itself, shared by both presentations: the controlled menu state,
 * which row's switch is in flight, and `selectOrg` — single-flight, with the
 * workspace-switch overlay, a reported and toasted failure, and the menu closed
 * only once a switch has landed.
 */
function useOrganizationSwitch({
  activeId,
  personalOrganizations,
  onSwitched,
}: {
  activeId: string | undefined;
  personalOrganizations: boolean;
  onSwitched: (() => void) | undefined;
}) {
  /**
   * The menu is CONTROLLED so it can be closed once a switch settles.
   *
   * `onSelect` calls `preventDefault()` to hold the menu open for the whole
   * round trip (SHELL-2 — see `renderOrg`), but an uncontrolled menu has no
   * second half to that: nothing ever closed it again. Team → team is a param
   * change on the `$organizationSlug` shell this control lives inside, so the
   * component stays mounted and the menu was left hanging open over the
   * freshly-switched clinic. Radix still drives every OTHER open/close —
   * trigger, Escape, outside click, re-picking the active row — through
   * `onOpenChange`; this state only adds the missing close-on-success.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * WHICH row's switch is in flight — not just "a" switch, so the row the user
   * actually pressed is the one that spins.
   *
   * `disabled={isLoading}` only ever covered the INITIAL me/context load, so from
   * the user's side a switch was indistinguishable from a dead menu: the menu
   * closed and nothing moved for a whole network round trip. `switchToPersonal()`
   * resolves *before* any navigation starts, so the RouteProgressBar — the app's
   * usual "something is happening" signal — is still idle for that entire
   * window (SHELL-2).
   */
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  /**
   * Synchronous single-flight latch (house rule 1). Switching re-mints the
   * GLOBAL access token, so two selections in the same frame — a double-tap, a
   * held Enter on a menu item — put two `/auth/switch-*` POSTs on the wire whose
   * round trips interleave. `switch.ts` already drops the *stale response* so the
   * wrong tenant can never win the token; this stops the second request being
   * made at all, which is the half a latest-wins generation counter cannot do.
   */
  const switchingRef = useRef(false);
  const navigate = useNavigate();
  const beginSwitch = useWorkspaceSwitchStore((state) => state.beginSwitch);
  const endSwitch = useWorkspaceSwitchStore((state) => state.endSwitch);

  async function applySelect(org: OrganizationSummary) {
    if (org.type === 'PERSONAL') {
      if (!personalOrganizations) return;
      await switchToPersonal();
      // A personal workspace has no clinic (D44), so it lands on the picker —
      // its list and "Create organization" are the way back into one.
      // Awaited, not `void`: a navigation that rejects is the other half of
      // "and on failure, nothing happens ever" — fire-and-forget put it out of
      // reach of the catch below, so it could not be reported either.
      await navigate(organizationPicker());
      return;
    }
    if (org.slug) await navigate(organizationHome(org.slug));
  }

  function selectOrg(org: OrganizationSummary) {
    // Re-picking the current org is a no-op; it must not arm the latch.
    if (org.id === activeId) return;
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitchingId(org.id);
    // Foreground feedback for the whole hop. The pressed row already shows a spinner, but the menu
    // closes over a screen still showing the OLD workspace's data while the guards, token re-mint
    // and queries land — so the answer to "did my click register?" was a row the user could no
    // longer see. Cleared in `finally`, on both outcomes.
    beginSwitch(org.name);

    applySelect(org)
      .then(() => {
        // The switch landed — now close the menu. It was held open for the
        // round trip on purpose (the pressed row IS the progress indicator),
        // but once the switch settles the user is looking at the destination
        // org with the menu still covering it.
        //
        // Deliberately in `.then` and NOT `.finally`: a FAILED switch keeps the
        // menu open so the retry is one click away rather than four, and so the
        // failure has somewhere to land other than a screen the user has
        // already been handed back.
        setMenuOpen(false);
        onSwitched?.();
      })
      .catch((error: unknown) => {
        // The bare `.catch(() => undefined)` was the bug: a failed switch looked
        // exactly like a slow one — no toast, no error, still on the old org, and
        // nothing in Sentry either. Both halves are restored here.
        reportError(error, {
          scope: 'organization-switcher',
          organizationId: org.id,
          organizationType: org.type,
        });
        notify.error(mapApiError(error), { id: ORG_SWITCH_TOAST_ID });
      })
      .finally(() => {
        endSwitch();
        /*
         * Released on BOTH outcomes, not just failure.
         *
         * Holding it after a success assumed the switcher was on its way out.
         * It is not: team → team is a param change on the `$organizationSlug`
         * shell, and this control lives in AppLayout INSIDE that shell, so
         * TanStack Router keeps it mounted. There is no effect resetting the
         * latch either — so the trigger stayed disabled with a spinner frozen
         * on the destination row, and the user could not switch again without
         * reloading the page. A `/suspended` redirect lands inside the same
         * shell and behaved identically.
         *
         * The double-submit guard this latch exists for is unaffected: it is
         * held for the whole round trip, and by the time it releases the token
         * is re-minted and `activeId` has moved, so re-picking the row the user
         * just switched to is already a no-op above.
         */
        switchingRef.current = false;
        setSwitchingId(null);
      });
  }

  return { menuOpen, setMenuOpen, switchingId, selectOrg };
}

/**
 * Active-organization switcher (dual-URL aware, FE-24). Lists the user's
 * organizations from `me/context`, split into **Personal** and **Organizations**
 * sections. Switching to a **team** org navigates to its home,
 * `/organization/$organizationSlug` (the org guard performs the
 * switch-on-navigation); switching to the **personal** org has no URL to drive
 * it, so it calls `switchToPersonal()` and lands on the `/organization` picker.
 */
/**
 * What both presentations read: whether the switcher shows at all, the
 * workspaces split into personal and team, the active one, and the switch.
 */
function useSwitcherModel(onSwitched: (() => void) | undefined) {
  const { t } = useTranslation(LAYOUT_NS);
  // A failed me/context used to pass in silence: the trigger just read "Select
  // organization" over an empty list, indistinguishable from a real empty
  // account (X-1). It now raises one toast carrying a Retry that refetches.
  // Deliberately NOT `throwOnError` — swapping the switcher for an error card
  // reflows the header around a control the user is mid-reach for; the toast
  // says the same thing without moving anything.
  const { data: ctx, isLoading } = useMeContext({ notifyOnError: true });
  const deploymentFlags = useDeploymentFlags();
  const orgs = useMyOrganizationSummaries().data ?? [];
  const visible = shouldShowOrganizationSwitcher(deploymentFlags);
  const invitations = useMyInvitations({ enabled: visible }).data ?? [];
  const navigate = useNavigate();
  const activeId = ctx?.activeOrganization?.id;
  const switching = useOrganizationSwitch({
    activeId,
    personalOrganizations: deploymentFlags.personalOrganizations,
    onSwitched,
  });
  const { switchingId, selectOrg } = switching;

  const renderOrg = (org: OrganizationSummary) => (
    <OrganizationOption
      key={org.id}
      org={org}
      isActive={org.id === activeId}
      isSwitching={switchingId === org.id}
      isDisabled={switchingId !== null && switchingId !== org.id}
      onChoose={selectOrg}
    />
  );

  const renderInvitation = (invitation: MyInvitation) => (
    <InvitedOption
      key={invitation.id}
      invitation={invitation}
      onChoose={() => {
        // Accept and Decline live on the picker; a parent menu closes on the way.
        onSwitched?.();
        void navigate(organizationPicker());
      }}
    />
  );

  return {
    ...switching,
    visible,
    invitations,
    renderInvitation,
    teamOnly: resolveDeploymentMode(deploymentFlags) === 'team-only',
    showCreateTeam: shouldAllowCreateTeam(deploymentFlags),
    personalOrgs: deploymentFlags.personalOrganizations
      ? orgs.filter((o) => o.type === 'PERSONAL')
      : [],
    teamOrgs: orgs.filter((o) => o.type === 'TEAM'),
    activeName:
      ctx?.activeOrganization?.name ?? t(LAYOUT_KEYS.app.orgSwitcher.selectPlaceholder),
    busy: isLoading || switchingId !== null,
    isLoading,
    renderOrg,
  };
}

/**
 * The switcher as a row of a parent menu (`presentation: 'submenu'`): the
 * workspaces beside it, no "Add", nothing at all with one workspace.
 */
function OrganizationSwitcherSubmenu({
  submenuLabel,
  onSwitched,
}: Pick<OrganizationSwitcherProps, 'submenuLabel' | 'onSwitched'>) {
  const model = useSwitcherModel(onSwitched);
  const workspaces = model.personalOrgs.length + model.teamOrgs.length;
  // Shown with somewhere to switch to — or an invitation to answer (D84).
  if (!model.visible || (workspaces <= 1 && model.invitations.length === 0)) {
    return null;
  }
  return (
    <OrganizationSubmenu
      open={model.menuOpen}
      onOpenChange={model.setMenuOpen}
      label={submenuLabel}
      activeName={model.activeName}
      busy={model.busy}
      invitationCount={model.invitations.length}
    >
      <OrganizationMenuSections
        personalOptions={model.personalOrgs.map(model.renderOrg)}
        teamOptions={model.teamOrgs.map(model.renderOrg)}
        invitedOptions={model.invitations.map(model.renderInvitation)}
        teamOnly={model.teamOnly}
        showCreateTeam={false}
        onCreate={() => undefined}
      />
    </OrganizationSubmenu>
  );
}

/**
 * Active-organization switcher (dual-URL aware, FE-24). Lists the user's
 * organizations from `me/context`, split into **Personal** and **Organizations**
 * sections. Switching to a **team** org navigates to its home,
 * `/organization/$organizationSlug` (the org guard performs the
 * switch-on-navigation); switching to the **personal** org has no URL to drive
 * it, so it calls `switchToPersonal()` and lands on the `/organization` picker.
 */
export function OrganizationSwitcher({
  presentation,
  submenuLabel,
  ...menuProps
}: OrganizationSwitcherProps) {
  return presentation === 'submenu' ? (
    <OrganizationSwitcherSubmenu
      submenuLabel={submenuLabel}
      onSwitched={menuProps.onSwitched}
    />
  ) : (
    <OrganizationSwitcherMenu {...menuProps} />
  );
}

/** The switcher with its own trigger — a compact outlined field. */
function OrganizationSwitcherMenu({
  className,
  align = 'start',
  onSwitched,
}: Pick<OrganizationSwitcherProps, 'className' | 'align' | 'onSwitched'>) {
  const { t } = useTranslation(LAYOUT_NS);
  const [createOpen, setCreateOpen] = useState(false);
  const {
    visible,
    menuOpen,
    setMenuOpen,
    switchingId,
    isLoading,
    activeName,
    personalOrgs,
    teamOrgs,
    teamOnly,
    showCreateTeam,
    renderOrg,
    invitations,
    renderInvitation,
  } = useSwitcherModel(onSwitched);

  if (!visible) return null;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-9 min-w-0 justify-start gap-2', className)}
            disabled={isLoading || switchingId !== null}
            aria-busy={switchingId !== null}
            aria-label={t(LAYOUT_KEYS.app.orgSwitcher.triggerLabel, {
              name: activeName,
            })}
            data-testid="organization-switcher-trigger"
            data-layout="field"
          >
            <TriggerIdentity name={activeName} />
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          // Never narrower than the control that opened it: under a wide
          // trigger a fixed 16rem menu stopped short of its end edge.
          className="w-[max(16rem,var(--radix-dropdown-menu-trigger-width))]"
        >
          <OrganizationMenuSections
            personalOptions={personalOrgs.map(renderOrg)}
            teamOptions={teamOrgs.map(renderOrg)}
            invitedOptions={invitations.map(renderInvitation)}
            teamOnly={teamOnly}
            showCreateTeam={showCreateTeam}
            onCreate={() => setCreateOpen(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
