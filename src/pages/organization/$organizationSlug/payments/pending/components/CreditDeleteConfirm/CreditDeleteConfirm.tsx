import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useDeleteCredit, useRestoreCredit } from '@/shared/hooks/useCredits/index.ts';

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
 * Delete a pending credit (KICKOFF §6.9; `payments.md:50, 291`): the shared
 * reason confirm titled "Delete this pending?" — the prototype reused "Delete
 * this payment?" (§7.3) — the party in the grey pill, the schema's
 * `delete_reason` chips. Optimistic; "CR-2 deleted" offers Undo for 10s (D32).
 */
export function CreditDeleteConfirm({
  credit,
  onClose,
  onDeleted,
}: CreditDeleteConfirmProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const remove = useDeleteCredit();
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
        await remove.mutateAsync({ id: credit.id, reason, note });
        onDeleted?.();
      }}
    />
  );
}
