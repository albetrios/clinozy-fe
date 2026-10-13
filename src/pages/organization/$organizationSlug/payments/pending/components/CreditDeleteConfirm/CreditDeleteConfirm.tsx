import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { CreditRow } from '@/shared/api/app/credits-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import { useDeleteCredit, useRestoreCredit } from '@/shared/hooks/useCredits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';

/** Props of {@link CreditDeleteConfirm}. */
export interface CreditDeleteConfirmProps {
  /** The credit to delete; the confirm is open while one is set. */
  credit: Pick<CreditRow, 'id' | 'seq' | 'partyName'> | null;
  /** "Keep it", the ×, the backdrop, Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the credit is removed (a drawer closes itself). */
  onDeleted?: () => void;
}

/**
 * Delete a pending credit (KICKOFF §6.9; `payments.md:50, 291`; `DELETE
 * /app/pending-credits/:id?reason=&note=`): the shared reason confirm titled
 * "Delete this pending?" — the prototype reused "Delete this payment?" (§7.3) —
 * the party in the grey pill, the API's delete reasons ("Other" needs a note).
 * Optimistic; "CR-2 deleted" offers Undo for 10s (D32, `POST …/restore`). Part
 * of it settled meanwhile (`409 credit_settled`) closes the confirm and says
 * so; the row comes back.
 */
export function CreditDeleteConfirm({
  credit,
  onClose,
  onDeleted,
}: CreditDeleteConfirmProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const remove = useDeleteCredit({ notifyOnError: false });
  const restore = useRestoreCredit();
  return (
    <ConfirmDialog
      open={credit !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(PAYMENTS_KEYS.pending.deleteTitle)}
      reason={{
        record: credit?.partyName,
        undo: credit
          ? {
              message: t(PAYMENTS_KEYS.pending.deleted, {
                ref: displayId.pendingCredit(credit.seq),
              }),
              onUndo: () => restore.mutateAsync(credit.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!credit) return;
        try {
          await remove.mutateAsync({ id: credit.id, reason, note });
        } catch (error) {
          if (apiErrorReason(error) === 'credit_settled') {
            // It can't be deleted any more: the confirm goes, with no Undo to offer.
            notify.error(
              t(PAYMENTS_KEYS.pending.conflicts.settled, {
                ref: displayId.pendingCredit(credit.seq),
              }),
            );
            onClose();
          } else {
            notifyError(error);
          }
          throw error;
        }
        onDeleted?.();
      }}
    />
  );
}
