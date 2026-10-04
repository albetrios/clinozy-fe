import { useTranslation } from 'react-i18next';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { Member } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useDeferredRowRemoval } from '@/shared/hooks/useDeferredRowRemoval/index.ts';
import { useRevokeInvitation } from '@/shared/hooks/useInvitations/index.ts';
import { useRemoveMember } from '@/shared/hooks/useMembers/index.ts';
import { useRemoveStaffProfile } from '@/shared/hooks/useTeam/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';

/** The Undo window of a removal (D32: Undo toasts run 10,000ms). */
const UNDO_MS = 10_000;

/** The member a delete confirm is about. */
export interface UserDeleteTarget {
  member: TeamMember;
  /**
   * The grey pill under the title: the name from a row, the drawer's summary
   * line from a drawer ("Dr. Reenal Chaniyara · Doctor · Adajan").
   */
  record?: string;
}

/** Props of {@link UserDeleteConfirm}. */
export interface UserDeleteConfirmProps {
  /** The member to remove; the confirm is open while one is set. */
  target: UserDeleteTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the pick. */
  onClose: () => void;
  /** Runs once the removal is scheduled (the drawer closes itself). */
  onDeleted?: () => void;
}

/**
 * Delete a user (KICKOFF §6.12 Delete confirm; `users.md:238–252`): the shared
 * reason confirm titled "Delete this user?", the name (or the drawer's
 * summary) in its pill. The row leaves the Team at once and "<name> removed"
 * offers Undo for 10s; only then does the membership go — `useRemoveMember`,
 * or, for an invited member, `useRevokeInvitation` (the invitation cancelled)
 * — and the staff profile with the reason picked (clinozy-be keeps no reason
 * for a membership, Appendix F). Never the owner's or your own row: the
 * screens offer no Delete there.
 */
export function UserDeleteConfirm({
  target,
  onClose,
  onDeleted,
}: UserDeleteConfirmProps) {
  const { t } = useTranslation(USERS_NS);
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const scheduleRemoval = useDeferredRowRemoval<Member>(
    orgQueryKeys.members(organizationId),
  );
  // The deferred toast owns the messages (SET-7): the writes stay quiet.
  const removeMember = useRemoveMember({ suppressSuccessToast: true });
  const revokeInvitation = useRevokeInvitation({ suppressSuccessToast: true });
  const removeProfile = useRemoveStaffProfile();

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(USERS_KEYS.deleteUser.title)}
      reason={{ record: target ? (target.record ?? target.member.name) : undefined }}
      onConfirm={({ reason, note }) => {
        if (!target) return;
        const { member } = target;
        const invitation = member.status === 'invited' ? member.invitation : null;
        scheduleRemoval({
          id: member.membershipId,
          pendingMessage: t(USERS_KEYS.deleteUser.removed, { name: member.name }),
          toastId: `remove-user-${member.membershipId}`,
          delayMs: UNDO_MS,
          commit: async () => {
            if (invitation) await revokeInvitation.mutateAsync(invitation.id);
            else await removeMember.mutateAsync(member.membershipId);
            if (member.profile) {
              await removeProfile.mutateAsync({ id: member.profile.id, reason, note });
            }
          },
        });
        onDeleted?.();
      }}
    />
  );
}
