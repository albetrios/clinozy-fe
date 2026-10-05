import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { LEDGER_KEYS, LEDGER_NS } from '@/shared/components/LedgerCells/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useDeletePayment, useRestorePayment } from '@/shared/hooks/usePayments/index.ts';

const K = LEDGER_KEYS.deleteEntry;

/**
 * The ledger's reasons (`payments.md:34`): "Entered twice" is the schema's
 * `duplicate`; the other two travel as `other` with their label in the note
 * (D32), and "Other" waits for a note.
 */
const LEDGER_REASONS: readonly ConfirmReasonOption[] = [
  { value: 'duplicate', labelKey: `${LEDGER_NS}:${K.reasons.twice}` },
  { value: 'wrong_amount', labelKey: `${LEDGER_NS}:${K.reasons.amount}` },
  { value: 'wrong_party', labelKey: `${LEDGER_NS}:${K.reasons.party}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** The entry a delete confirm is about, and the due its invoice goes back to. */
export interface PaymentDeleteTarget {
  entry: Pick<LedgerRow, 'id' | 'seq' | 'kind' | 'amount' | 'invoice'>;
  /** A receipt's invoice due once the entry is gone, in paise. */
  dueAfter?: number;
}

/** Props of {@link PaymentDeleteConfirm}. */
export interface PaymentDeleteConfirmProps {
  /** The entry to delete; the confirm is open while one is set. */
  target: PaymentDeleteTarget | null;
  /** "Keep it", the ×, the backdrop, Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the entry is removed (a drawer closes itself). */
  onDeleted?: () => void;
}

/**
 * Delete a ledger entry (KICKOFF §6.9 Delete confirm; `payments.md:34,
 * 282–294`): the shared reason confirm titled "Delete this payment?", the entry
 * as "PAY-310" in the grey pill, the ledger's reasons and the body "Allowed
 * until the day is closed. Invoice #785 goes back to ₹1,476 due. The deletion
 * is kept in the audit log." (the invoice sentence only for a receipt against
 * one). The soft delete is optimistic and "PAY-310 removed" — "· invoice
 * balance restored" for such a receipt — offers Undo for 10s (D32, `S:1546`).
 */
export function PaymentDeleteConfirm({
  target,
  onClose,
  onDeleted,
}: PaymentDeleteConfirmProps) {
  const { t } = useTranslation(LEDGER_NS);
  const formatPaise = usePaiseFormat();
  const remove = useDeletePayment();
  const restore = useRestorePayment();
  const entry = target?.entry;
  const ref = entry ? displayId.payment(entry.seq) : '';
  const invoiceSentence =
    entry?.kind === 'receipt' && entry.invoice && target?.dueAfter !== undefined;
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(K.title)}
      description={
        invoiceSentence && entry?.invoice
          ? t(K.effectInvoice, {
              seq: entry.invoice.seq,
              due: formatPaise(target?.dueAfter ?? 0),
            })
          : t(K.effect)
      }
      reason={{
        record: ref,
        options: LEDGER_REASONS,
        undo: entry
          ? {
              message: t(invoiceSentence ? K.removedInvoice : K.removed, { ref }),
              onUndo: () => restore.mutateAsync(entry.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!entry) return;
        await remove.mutateAsync({ id: entry.id, reason, note });
        onDeleted?.();
      }}
    />
  );
}
