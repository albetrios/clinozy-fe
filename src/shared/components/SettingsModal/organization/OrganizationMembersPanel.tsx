import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { isListStale, listRefreshClass } from '@/lib/list-refresh.ts';
import { cn } from '@/lib/utils.ts';
import {
  isInvitableRole,
  isInvitationExpired,
  type Member,
  type MemberInvitation,
  type RoleSummary,
} from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { InviteMemberDialog } from '@/shared/components/InviteMemberDialog/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  SettingsList,
  SettingsListRow,
  settingsRowActionClass,
} from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Spinner } from '@/shared/components/Spinner/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useAccessResolved, useCan } from '@/shared/hooks/useCan/index.ts';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedValue/index.ts';
import { useDeferredRowRemoval } from '@/shared/hooks/useDeferredRowRemoval/index.ts';
import {
  useResendInvitation,
  useRevokeInvitation,
} from '@/shared/hooks/useInvitations/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  useMembers,
  useRemoveMember,
  useUpdateMember,
} from '@/shared/hooks/useMembers/index.ts';
import { usePlatformRoles } from '@/shared/hooks/useTeam/index.ts';
import { MoreHorizontal, UserPlus, Users } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  DEFAULT_ORG_LIST_SORT,
  type OrgListSortPreset,
  orgListSortToParams,
} from './org-list-sort.ts';
import { OrgListControls } from './OrgListControls.tsx';
import { useUsersRoomOpen } from './users-room-open.ts';
import { UsersRoomLink } from './UsersRoomLink.tsx';

/**
 * A member status's pill tone, as the Users room paints it: active sage,
 * invited butter, suspended (the room's "Inactive") plain.
 */
function statusTone(status: Member['status']): PillTone {
  if (status === 'active') return 'sage';
  if (status === 'invited') return 'butter';
  return 'neutral';
}

function MembersLoading() {
  return <PanelSkeleton testId="members-loading" />;
}

/**
 * The live invitation behind an invited row, or `null` for everyone else
 * (including an invited row clinozy-be reported without one).
 */
function pendingInvitationOf(member: Member): MemberInvitation | null {
  return member.status === 'invited' ? (member.invitation ?? null) : null;
}

/** A member's roles with their main role replaced — the others stay as they are. */
function withMainRole(member: Member, roleId: string): string[] {
  return [roleId, ...member.roleIds.slice(1).filter((id) => id !== roleId)];
}

/** What the caller may do to a member row — each its own clinozy-be code. */
interface MemberRowAccess {
  /** Roles, suspend / reactivate, and resend an invitation (`membership:update`). */
  canUpdate: boolean;
  /** Remove a member, cancel an invitation (`membership:delete`). */
  canDelete: boolean;
}

/**
 * The row menu's last group. On an invited row: resend (`membership:update` —
 * an expired link too: clinozy-be sends a fresh one) and cancel
 * (`membership:delete`). Otherwise Remove (`membership:delete`).
 *
 * Cancel replaces Remove on an invited row: clinozy-be revokes the link and
 * ends the invited membership in one step, so the invitee's link says it was
 * revoked rather than "not found".
 */
function MemberRowEndItems({
  member,
  access,
  isWriting,
  onResend,
  onRemove,
  onCancelInvitation,
}: {
  member: Member;
  access: MemberRowAccess;
  isWriting: boolean;
  onResend: (member: Member) => void;
  onRemove: (member: Member) => void;
  onCancelInvitation: (member: Member, invitation: MemberInvitation) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const panels = SETTINGS_KEYS.panels.members;
  const invitation = pendingInvitationOf(member);

  if (invitation) {
    return (
      <>
        {access.canUpdate ? (
          <DropdownMenuItem
            disabled={isWriting}
            onSelect={() => onResend(member)}
            data-testid={`member-resend-invite-${member.id}`}
          >
            {t(panels.resendInvite)}
          </DropdownMenuItem>
        ) : null}
        {access.canDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onCancelInvitation(member, invitation)}
            data-testid={`member-cancel-invite-${member.id}`}
          >
            {t(panels.cancelInvite)}
          </DropdownMenuItem>
        ) : null}
      </>
    );
  }
  if (!access.canDelete) return null;
  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() => onRemove(member)}
      data-testid={`member-remove-${member.id}`}
    >
      {t(panels.removeAction)}
    </DropdownMenuItem>
  );
}

/**
 * Per-member management menu. With `membership:update`: change the main role
 * (to any role but the owner's; the member's other roles stay), suspend or
 * reactivate a joined member, resend an invitation. With `membership:delete`:
 * remove, or cancel an invitation. The owner's row shows no actions (an
 * organization can't manage its owner from here).
 */
function MemberRowActions({
  member,
  roles,
  access,
  onRemove,
  onCancelInvitation,
}: {
  member: Member;
  roles: readonly RoleSummary[];
  access: MemberRowAccess;
  onRemove: (member: Member) => void;
  onCancelInvitation: (member: Member, invitation: MemberInvitation) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const panels = SETTINGS_KEYS.panels.members;
  const updateMember = useUpdateMember();
  const resendInvitation = useResendInvitation();

  // Every role but the owner's preset, by its system flag and fixed name — never a bare name
  // compare (a custom role called "Owners" slipped through one). UI robustness only: clinozy-be
  // runs the real guard and refuses a role carrying a code the caller does not hold.
  const assignableRoles = roles.filter(isInvitableRole);
  const isSuspended = member.status === 'suspended';
  /**
   * One membership write at a time. The menu is still clickable while a change
   * is in flight, and `useAppMutation` JOINS a second call to the first - so
   * the second pick looked accepted and then vanished. Disable it (SET-12).
   */
  const isWriting = updateMember.isPending || resendInvitation.isPending;
  // Suspend/reactivate only applies once a member has actually joined — clinozy-be
  // rejects flipping a never-joined (invited) membership to active. Invited
  // members get role-change plus the invitation actions below.
  const hasJoined = member.joinedAt !== '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className={settingsRowActionClass()}
          aria-label={t(panels.actionsAria, { name: member.name })}
          data-testid={`member-actions-${member.id}`}
          aria-busy={isWriting}
        >
          {/* Radix closes the menu on select, so the disabled items are out of
              sight while the write runs. The row keeps the busy state visible. */}
          {isWriting ? <Spinner /> : <MoreHorizontal className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {access.canUpdate && assignableRoles.length > 0 ? (
          <>
            <DropdownMenuLabel>{t(panels.changeRole)}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={member.roleId}
              onValueChange={(roleId) => {
                // Radix fires this for the already-selected item too - re-picking
                // the member's current role is not a change, and used to send a
                // PATCH and toast "Role updated" for nothing.
                if (isWriting || roleId === member.roleId) return;
                if (assignableRoles.some((role) => role.id === roleId)) {
                  updateMember.mutate({
                    membershipId: member.id,
                    change: { roleIds: withMainRole(member, roleId) },
                  });
                }
              }}
            >
              {assignableRoles.map((role) => (
                <DropdownMenuRadioItem
                  key={role.id}
                  value={role.id}
                  disabled={isWriting}
                  data-testid={`member-set-role-${role.id}`}
                >
                  {role.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {access.canUpdate && hasJoined ? (
          <DropdownMenuItem
            disabled={isWriting}
            onSelect={() =>
              updateMember.mutate({
                membershipId: member.id,
                change: { status: isSuspended ? 'active' : 'suspended' },
              })
            }
            data-testid={`member-toggle-status-${member.id}`}
          >
            {isSuspended ? t(panels.reactivate) : t(panels.suspend)}
          </DropdownMenuItem>
        ) : null}
        <MemberRowEndItems
          member={member}
          access={access}
          isWriting={isWriting}
          onResend={(row) => resendInvitation.mutate(row.id)}
          onRemove={onRemove}
          onCancelInvitation={onCancelInvitation}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** An invited member together with the invitation a cancel acts on. */
type InvitationTarget = { member: Member; invitation: MemberInvitation };

/** When an invited row's link expires, or that it already has. */
function InvitationExpiry({
  memberId,
  invitation,
}: {
  memberId: string;
  invitation: MemberInvitation;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const { formatDate } = useLocaleFormat();
  const panels = SETTINGS_KEYS.panels.members;
  const expired = isInvitationExpired(invitation);
  return (
    <p
      className={cn(
        'truncate text-xs',
        expired ? 'text-destructive' : 'text-muted-foreground',
      )}
      data-testid={`member-invite-expiry-${memberId}`}
    >
      {expired
        ? t(panels.inviteExpired)
        : t(panels.inviteExpires, { date: formatDate(invitation.expiresAt) })}
    </p>
  );
}

/**
 * One member: who they are, their role and status, an invited row's expiry, and
 * the row menu.
 */
function MemberRow({
  member,
  roles,
  access,
  onRemove,
  onCancelInvitation,
}: {
  member: Member;
  roles: readonly RoleSummary[];
  access: MemberRowAccess;
  onRemove: (member: Member) => void;
  onCancelInvitation: (member: Member, invitation: MemberInvitation) => void;
}) {
  const invitation = pendingInvitationOf(member);
  const hasActions = access.canUpdate || access.canDelete;
  // The main role's name — only for a caller who may read the roles.
  const mainRoleName = roles.find((role) => role.id === member.roleId)?.name;

  return (
    <SettingsListRow>
      {/* A table row's primary cell: the 32px avatar, the name 13px/500, the
          email under it 11.5px muted. */}
      <PersonAvatar
        initials={personInitials(member.name) || '?'}
        tone="stone"
        size="cell"
      />
      <div className="min-w-0 flex-1">
        <p dir="auto" className="text-body truncate font-medium">
          {member.name}
        </p>
        {member.email !== member.name ? (
          <p
            dir="ltr"
            className="text-muted-foreground text-caption truncate [text-align:match-parent]"
          >
            {member.email}
          </p>
        ) : null}
        {invitation ? (
          <InvitationExpiry memberId={member.id} invitation={invitation} />
        ) : null}
      </div>
      {mainRoleName ? (
        <TonePill tone="neutral" size="sm" className="hidden capitalize sm:inline-flex">
          {mainRoleName}
        </TonePill>
      ) : null}
      <TonePill tone={statusTone(member.status)} size="sm" dot className="capitalize">
        {member.status}
      </TonePill>
      {hasActions && !member.isOwner ? (
        // One row's menu is its own failure domain - a member with
        // malformed data must not blank the whole list.
        <SectionErrorBoundary
          variant="inline"
          title={member.name}
          testId={`member-actions-error-${member.id}`}
        >
          <MemberRowActions
            member={member}
            roles={roles}
            access={access}
            onRemove={onRemove}
            onCancelInvitation={onCancelInvitation}
          />
        </SectionErrorBoundary>
      ) : null}
    </SettingsListRow>
  );
}

/**
 * Confirms cancelling an invitation. The dismiss button says "Keep invitation":
 * next to "Cancel invitation", a plain "Cancel" reads as a second way to do the
 * same thing.
 */
function CancelInvitationDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: InvitationTarget | null;
  onClose: () => void;
  onConfirm: (target: InvitationTarget) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const panels = SETTINGS_KEYS.panels.members;
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(panels.cancelInviteTitle, { email: target?.member.email ?? '' })}
      description={t(panels.cancelInviteDescription)}
      confirmLabel={t(panels.cancelInviteConfirm)}
      cancelLabel={t(panels.cancelInviteKeep)}
      destructive
      onConfirm={() => {
        if (target) onConfirm(target);
      }}
    />
  );
}

/**
 * Whether this caller can complete an invite, which takes two grants rather than one.
 *
 * Invite calls `POST /tenancy/organization/memberships`, gated on `membership:create` (team
 * organizations only). The dialog also has to list roles to pick one (`GET .../roles`,
 * `role:read`); without that the picker renders empty and the invite cannot be finished, so
 * offering the trigger would be a dead end.
 */
function useCanInviteMembers(): boolean {
  const canCreateMembers = useCan({
    permission: 'membership:create',
    teamOrganizationOnly: true,
  });
  const canReadRoles = useCan({ permission: 'role:read' });
  return canCreateMembers && canReadRoles;
}

/** The list area: loading, a retryable error, the empty state, or the members and "Load more". */
function MembersList({
  members,
  roles,
  isSearching,
  isStale,
  access,
  onRemove,
  onCancelInvitation,
}: {
  members: ReturnType<typeof useMembers>;
  roles: readonly RoleSummary[];
  isSearching: boolean;
  isStale: boolean;
  access: MemberRowAccess;
  onRemove: (member: Member) => void;
  onCancelInvitation: (member: Member, invitation: MemberInvitation) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const panels = SETTINGS_KEYS.panels.members;
  return (
    <>
      {members.isPending ? <MembersLoading /> : null}

      {members.isError ? (
        <RetryError
          message={t(panels.loadFailed)}
          onRetry={members.refetch}
          isRetrying={members.isFetching}
        />
      ) : null}

      {!(members.isPending || members.isError) && members.rows.length === 0 ? (
        <EmptyState
          tone="sky"
          className="pt-8 pb-9"
          icon={<Users />}
          title={isSearching ? t(panels.noResults) : t(panels.emptyTitle)}
          description={isSearching ? '' : t(panels.emptyDescription)}
        />
      ) : null}

      {!members.isError && members.rows.length > 0 ? (
        <>
          <SettingsList
            frameClassName={listRefreshClass(isStale)}
            aria-busy={isStale}
            data-testid="members-list"
          >
            {members.rows.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                roles={roles}
                access={access}
                onRemove={onRemove}
                onCancelInvitation={onCancelInvitation}
              />
            ))}
          </SettingsList>
          {members.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={members.fetchNextPage}
                disabled={members.isFetchingNextPage}
                data-testid="members-load-more"
              >
                {t(panels.loadMore)}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/**
 * Members panel — a link into the Users room's Team where the room is this
 * member's members surface (D17, {@link useUsersRoomOpen}); everywhere else the
 * members list itself ({@link MembersManager}), so no deployment and no
 * permission set loses what it could do here.
 */
export function OrganizationMembersPanel() {
  return useUsersRoomOpen() ? <UsersRoomLink section="members" /> : <MembersManager />;
}

/**
 * The active organization's people. Lists members with their main role (for a
 * caller who may read roles) and status. Edits need `membership:update`;
 * removal needs `membership:delete` (team organizations only) and goes through
 * an undo-capable deferred commit. An invited row shows when its invitation
 * expires; `membership:update` resends it, `membership:delete` cancels it —
 * through the same confirm + undo flow as removal.
 */
function MembersManager() {
  const { t } = useTranslation(SETTINGS_NS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<OrgListSortPreset>(DEFAULT_ORG_LIST_SORT);
  const { debounced: debouncedSearch, isPending: isSearchPending } =
    useDebouncedSearch(search);
  const sortParams = orgListSortToParams(sort);
  const members = useMembers({
    q: debouncedSearch || undefined,
    ...sortParams,
  });
  const canUpdate = useCan({ permission: 'membership:update' });
  const canDelete = useCan({
    permission: 'membership:delete',
    teamOrganizationOnly: true,
  });
  const access: MemberRowAccess = { canUpdate, canDelete };
  const canInvite = useCanInviteMembers();
  // The role names and the picker's choices — nothing for a caller without `role:read`.
  const { roles } = usePlatformRoles();
  /**
   * `useCan` is synchronous and the guard chain fills the permission set a beat
   * after this panel first renders, so a `false` here can mean "not yet". A
   * disabled placeholder of the same size holds the slot instead of leaving a
   * gap that fills itself a moment later (SET-23).
   */
  const accessResolved = useAccessResolved();
  /**
   * The undo toast owns the whole message sequence for a deferred removal
   * ("Removing Jo…" → "Member removed"), so the mutation must stay quiet —
   * otherwise one removal is confirmed twice, five seconds apart (SET-7).
   */
  const removeMember = useRemoveMember({ suppressSuccessToast: true });
  const organizationId = useOrganizationStore((s) => s.organizationId);
  /**
   * Removal runs through the shared row-removal hook rather than the raw
   * `notifyDeferredCommit`: the row has to leave the list at SCHEDULE time (the
   * mutation's own optimistic patch is five seconds away, so the toast used to
   * say "Removing Jo…" while Jo sat in the table), undo and a failed write both
   * have to put that row back, and an unmount inside the undo window has to
   * cancel the pending write instead of leaking a timer at a dead panel.
   */
  const scheduleRemoval = useDeferredRowRemoval<Member>(
    orgQueryKeys.members(organizationId),
  );
  const [toRemove, setToRemove] = useState<Member | null>(null);
  // Same contract as removal: the undo toast owns the messages (SET-7).
  const revokeInvitation = useRevokeInvitation({ suppressSuccessToast: true });
  const [toCancel, setToCancel] = useState<InvitationTarget | null>(null);

  const panels = SETTINGS_KEYS.panels.members;
  const isSearching = debouncedSearch.length > 0;
  const isStale = isListStale(members.isRefreshing, isSearchPending);

  return (
    <section className="flex flex-col gap-4" data-testid="settings-organization-members">
      <SettingsSectionHeader section="members" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <OrgListControls
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          searchPlaceholder={t(panels.searchPlaceholder)}
          searchTestId="members-search"
          sortTestId="members-sort"
        />
        {accessResolved ? null : (
          <Button size="sm" disabled data-testid="invite-member-pending">
            <UserPlus className="size-4" />
            {t(panels.invite)}
          </Button>
        )}
        {accessResolved && canInvite ? <InviteMemberDialog /> : null}
      </div>

      <MembersList
        members={members}
        roles={roles}
        isSearching={isSearching}
        isStale={isStale}
        access={access}
        onRemove={setToRemove}
        onCancelInvitation={(row, invitation) => setToCancel({ member: row, invitation })}
      />

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => {
          if (!open) setToRemove(null);
        }}
        title={t(panels.removeTitle, {
          name: toRemove?.name ?? t(panels.memberFallback),
        })}
        description={t(panels.removeDescription)}
        confirmLabel={t(panels.removeConfirm)}
        destructive
        onConfirm={() => {
          if (!toRemove) return;
          const member = toRemove;
          setToRemove(null);
          scheduleRemoval({
            id: member.id,
            pendingMessage: t(panels.removePending, { name: member.name }),
            // The copy the mutation would have toasted, handed to the undo
            // toast so the whole sequence lands on one toast id.
            committedMessage: i18n.t(ERRORS_KEYS.frontend.hooks.members.removeSuccess, {
              ns: ERRORS_NS,
            }),
            toastId: `remove-member-${member.id}`,
            // `mutateAsync`, never `mutate`: the deferred commit has to AWAIT
            // the DELETE. `mutate` returns void, so the toast reported success
            // before the request landed and a rejection could never reach
            // `onCommitError` — the row stayed gone after a failed delete.
            // Settings asks no reason: a removal here is "not needed" (as the Users room's default).
            commit: () =>
              removeMember.mutateAsync({ membershipId: member.id, reason: 'not_needed' }),
          });
        }}
      />

      <CancelInvitationDialog
        target={toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={({ member }) => {
          setToCancel(null);
          // The row leaves now and comes back on undo or a failed revoke, exactly
          // as a removal does. The write is the invited membership's invitation
          // revoke, which clinozy-be pairs with ending that membership.
          scheduleRemoval({
            id: member.id,
            pendingMessage: t(panels.cancelInvitePending, { email: member.email }),
            committedMessage: i18n.t(
              ERRORS_KEYS.frontend.hooks.invitations.cancelSuccess,
              {
                ns: ERRORS_NS,
              },
            ),
            toastId: `cancel-invite-${member.id}`,
            commit: () => revokeInvitation.mutateAsync(member.id),
          });
        }}
      />
    </section>
  );
}
