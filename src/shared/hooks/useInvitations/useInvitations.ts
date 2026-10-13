import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import * as orgApi from '@/shared/api/organization-api.ts';
import type { Member, MemberInvite } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import {
  useAppMutation,
  type WriteReportOptions,
} from '@/shared/hooks/useAppMutation/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Invite a member by email. clinozy-be models an invitation as an invited membership
 * (`POST /tenancy/organization/memberships`), so the new invitee lands in the members list —
 * invalidate that, not a separate invitations list. Resend and cancel act on that invited
 * membership (below). One idempotency key per invite: a "Retry" after a dropped answer replays
 * clinozy-be's first answer instead of inviting twice.
 */
export function useInviteMember(options?: WriteReportOptions) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (invite: MemberInvite, action) =>
      orgApi.inviteMember({ invite, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [orgQueryKeys.members(orgId)],
    // The Users room's user drawer names the person once the whole save is done
    // ("<name> added", D28) — one toast for the whole save.
    successMessage: options?.suppressSuccessToast
      ? undefined
      : (member) =>
          i18n.t(ERRORS_KEYS.frontend.hooks.invitations.sendSuccess, {
            ns: ERRORS_NS,
            email: member.email,
          }),
    notifyOnError: options?.notifyOnError ?? true,
  });
}

/**
 * Send an invited member's link again — by the membership id — then refresh the members list so
 * the row shows its new expiry. An expired invitation is sent again too.
 *
 * @remarks
 * A refusal (already accepted, rate-limited) surfaces through the mutation's default error
 * toast, with clinozy-be's own reason.
 */
export function useResendInvitation() {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (membershipId: string, action) =>
      orgApi.resendInvitation(membershipId, action.idempotencyKey),
    invalidateKeys: [orgQueryKeys.members(orgId)],
    successMessage: (result) =>
      i18n.t(ERRORS_KEYS.frontend.hooks.invitations.resendSuccess, {
        ns: ERRORS_NS,
        email: result.email,
      }),
  });
}

/**
 * Cancel an invited member's invitation — by the membership id. clinozy-be ends the invited
 * membership with it, so the row leaves the list: optimistically here, then for real on refresh.
 *
 * @remarks
 * Callers that run this behind the undo toast own the whole message sequence,
 * so they pass `suppressSuccessToast` (the same contract as `useRemoveMember`).
 */
export function useRevokeInvitation(options?: { suppressSuccessToast?: boolean }) {
  const orgId = useOrganizationStore((s) => s.organizationId);
  return useAppMutation({
    mutationFn: (membershipId: string) => orgApi.revokeInvitation(membershipId),
    invalidateKeys: [orgQueryKeys.members(orgId)],
    optimisticInfinite: {
      queryKey: orgQueryKeys.members(orgId),
      update: (rows: Member[], membershipId) =>
        rows.filter((member) => member.id !== membershipId),
    },
    successMessage: options?.suppressSuccessToast
      ? undefined
      : i18n.t(ERRORS_KEYS.frontend.hooks.invitations.cancelSuccess, { ns: ERRORS_NS }),
  });
}
