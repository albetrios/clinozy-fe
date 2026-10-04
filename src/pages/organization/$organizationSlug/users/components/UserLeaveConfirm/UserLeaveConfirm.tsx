import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { organizationPicker } from '@/lib/routes/index.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { Member } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useDeferredRowRemoval } from '@/shared/hooks/useDeferredRowRemoval/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useLeaveOrganization } from '@/shared/hooks/useMembers/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';

/** The Undo window of a leave (D32: Undo toasts run 10,000ms). */
const UNDO_MS = 10_000;

/** Props of {@link UserLeaveConfirm}. */
export interface UserLeaveConfirmProps {
  /** Your own row — never the owner's; the confirm is open while it is set. */
  member: TeamMember | null;
  /** "Stay", the ×, the backdrop and Esc. */
  onClose: () => void;
  /** Runs once the leave is scheduled (the drawer closes itself). */
  onScheduled?: () => void;
}

/**
 * Leave clinic (D17 — Settings' self-removal, relocated): "Leave <clinic>?"
 * and, on confirm, your row leaves the Team at once while "Leaving <clinic>…"
 * offers Undo for 10s; only then does the membership go
 * (`useLeaveOrganization`, the self-service leave) and the session context
 * with it, and you land on your clinics (`/organization`) — the clinic's
 * pages would only fail from here. The owner never sees it: clinozy-be makes
 * them transfer ownership first.
 */
export function UserLeaveConfirm({
  member,
  onClose,
  onScheduled,
}: UserLeaveConfirmProps) {
  const { t } = useTranslation(USERS_NS);
  const navigate = useNavigate();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const clinic =
    useMeContext().data?.activeOrganization?.name?.trim() ||
    t(USERS_KEYS.leave.clinicFallback);
  const scheduleRemoval = useDeferredRowRemoval<Member>(
    orgQueryKeys.members(organizationId),
  );
  const leave = useLeaveOrganization();

  return (
    <ConfirmDialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(USERS_KEYS.leave.title, { clinic })}
      description={t(USERS_KEYS.leave.description, { clinic })}
      confirmLabel={t(USERS_KEYS.leave.confirm)}
      cancelLabel={t(USERS_KEYS.leave.stay)}
      destructive
      onConfirm={() => {
        if (!member) return;
        scheduleRemoval({
          id: member.membershipId,
          pendingMessage: t(USERS_KEYS.leave.pending, { clinic }),
          committedMessage: t(USERS_KEYS.leave.done, { clinic }),
          toastId: `leave-${member.membershipId}`,
          delayMs: UNDO_MS,
          commit: async () => {
            await leave.mutateAsync();
            await navigate({ ...organizationPicker(), replace: true });
          },
        });
        onScheduled?.();
      }}
    />
  );
}
