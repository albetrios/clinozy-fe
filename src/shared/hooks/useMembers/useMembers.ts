import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import * as orgApi from '@/shared/api/organization-api.ts';
import type { Member, MemberChange } from '@/shared/api/organization-contracts.ts';
import {
  type OrgListKeyParams,
  orgQueryKeys,
} from '@/shared/api/organization-query-keys.ts';
import {
  useAppMutation,
  type WriteReportOptions,
} from '@/shared/hooks/useAppMutation/index.ts';
import {
  type CursorListResult,
  useCursorList,
} from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { invalidateSessionContext } from '@/shared/tenancy/session-context.ts';

/** Server-side query params for the members list (search + sort). */
export type MembersListParams = OrgListKeyParams;

/**
 * Members of the active organization — windowed list query + edit/removal
 * mutations. Server state only — never mirrored into Zustand (fe-file-structure.mdc).
 * The list is cursor-paginated server-side (search `q`, sort, + `Load more`);
 * mutations patch every cached page optimistically via `optimisticInfinite`.
 */
export function useMembers(params: MembersListParams = {}): CursorListResult<Member> {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useCursorList<Member>({
    queryKey: orgQueryKeys.membersList(orgId, params),
    queryFn: (after) => orgApi.listMembers({ ...params, after }),
    // The members panel renders a RetryError for exactly this failure.
    notifyOnError: false,
    // No active org (mid org-switch, or before context resolves) → skip the
    // request instead of firing a `Forbidden` against an empty org scope.
    enabled: Boolean(orgId),
  });
}

/** What {@link useUpdateMember} takes: the membership and its change. */
export interface MemberUpdateInput {
  membershipId: string;
  change: MemberChange;
}

/** Whether an edit changes this one field and nothing else. */
const changesOnly = (change: MemberChange, field: keyof MemberChange) =>
  change[field] !== undefined &&
  Object.keys(change).every((key) => key === field || key === 'expectedUpdatedAt');

/**
 * The success toast of a member edit: suspended / reactivated for the status alone, "role
 * updated" for the roles alone, else "saved".
 */
function memberUpdateMessage(change: MemberChange): string {
  const keys = ERRORS_KEYS.frontend.hooks.members;
  if (changesOnly(change, 'status')) {
    return i18n.t(
      change.status === 'suspended' ? keys.suspendSuccess : keys.reactivateSuccess,
      { ns: ERRORS_NS },
    );
  }
  if (changesOnly(change, 'roleIds')) {
    return i18n.t(keys.updateRoleSuccess, { ns: ERRORS_NS });
  }
  return i18n.t(keys.updateSuccess, { ns: ERRORS_NS });
}

/**
 * Change a member — roles, status, or their clinic details — with the row patched in every
 * cached page at once, rolled back on failure, then the list refreshed.
 * `suppressSuccessToast`: the caller reports the whole save itself (the Users room's user drawer,
 * "<name> saved").
 */
export function useUpdateMember(options?: WriteReportOptions) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (input: MemberUpdateInput, action) =>
      orgApi.updateMember({ ...input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [orgQueryKeys.members(orgId)],
    optimisticInfinite: {
      queryKey: orgQueryKeys.members(orgId),
      update: (rows: Member[], { membershipId, change }) =>
        rows.map((member) =>
          member.id === membershipId ? withMemberChange(member, change) : member,
        ),
    },
    successMessage: options?.suppressSuccessToast
      ? undefined
      : (_member, input) => memberUpdateMessage(input.change),
    notifyOnError: options?.notifyOnError ?? true,
  });
}

/** A member with an edit applied — the optimistic row. */
export function withMemberChange(member: Member, change: MemberChange): Member {
  // The stale-save guard is the request's, not the row's.
  const next = { ...member, ...change };
  delete next.expectedUpdatedAt;
  return change.roleIds ? { ...next, roleId: change.roleIds[0] ?? '' } : next;
}

/** What {@link useRemoveMember} takes: the membership and why it goes. */
export interface MemberRemovalInput {
  membershipId: string;
  reason: DeleteReason;
  note?: string;
}

/** Remove a member — optimistically drops the row from the list. */
export function useRemoveMember(options?: { suppressSuccessToast?: boolean }) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (input: MemberRemovalInput) => orgApi.removeMember(input),
    invalidateKeys: [orgQueryKeys.members(orgId)],
    optimisticInfinite: {
      queryKey: orgQueryKeys.members(orgId),
      update: (rows: Member[], { membershipId }) =>
        rows.filter((member) => member.id !== membershipId),
    },
    // Callers that run this behind the undo toast own the whole message
    // sequence; a second success toast five seconds after the first one is the
    // same removal reported twice (SET-7).
    successMessage: options?.suppressSuccessToast
      ? undefined
      : i18n.t(ERRORS_KEYS.frontend.hooks.members.removeSuccess, { ns: ERRORS_NS }),
  });
}

/**
 * Leave the active organization — your own membership, revoked
 * (`POST /organization/leave`; any member but the owner, no permission code).
 * Once it lands the session context and the organization list are dropped, so
 * the next guard reads both afresh — without the organization just left.
 * Silent: the caller's deferred toast owns the messages (SET-7).
 */
export function useLeaveOrganization() {
  return useAppMutation<void, void>({
    mutationFn: async () => {
      await orgApi.leaveOrganization();
      invalidateSessionContext();
    },
  });
}
