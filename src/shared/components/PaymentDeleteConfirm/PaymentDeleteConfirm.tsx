import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { LEDGER_KEYS, LEDGER_NS } from '@/shared/components/LedgerCells/index.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import {
  useFixtureDeletePayment,
  useFixtureRestorePayment,
} from '@/shared/hooks/useFixtureLedger/index.ts';
import { useDeletePayment, useRestorePayment } from '@/shared/hooks/usePayments/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

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

/** clinozy-be's `409` reasons for a delete, in the room's words. */
const DELETE_BLOCK_KEYS: Readonly<Record<string, string>> = {
  /** Its day closed meanwhile: a closed day's entry is reversed, never deleted. */
  day_closed: K.blocked.dayClosed,
  /** A refund already gave this money back: taking it off would leave the invoice below zero. */
  more_than_paid: K.blocked.moreThanPaid,
};

/** The entry a delete confirm is about, and the due its invoice goes back to. */
export interface PaymentDeleteTarget {
  entry: Pick<LedgerRow, 'id' | 'seq' | 'kind' | 'amount' | 'invoice'>;
  /** A receipt's invoice due once the entry is gone, in rupees. */
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
  /** The parked Medical room's entry: deleted and restored on the fixture ledger (D153 seam). */
  fixture?: boolean;
}

/** The delete and its Undo — on clinozy-be, or on the fixture ledger for the parked Medical room. */
function useEntryWrites(fixture: boolean) {
  const live = {
    remove: useDeletePayment({ notifyOnError: false }),
    restore: useRestorePayment(),
  };
  const parked = {
    remove: useFixtureDeletePayment({ notifyOnError: false }),
    restore: useFixtureRestorePayment(),
  };
  return fixture ? parked : live;
}

/**
 * Delete a ledger entry (KICKOFF §6.9 Delete confirm; `payments.md:34,
 * 282–294`): the shared reason confirm titled "Delete this payment?", the entry
 * as "PAY-310" in the grey pill, the ledger's reasons and the body "Allowed
 * until the day is closed. Invoice #785 goes back to ₹1,476 due. The deletion
 * is kept in the audit log." (the invoice sentence only for a receipt against
 * one). The soft delete is optimistic and "PAY-310 removed" — "· invoice
 * balance restored" for such a receipt — offers Undo for 10s (D32, `S:1546`).
 * A refusal (`409 day_closed` — the day closed meanwhile, the entry is reversed instead;
 * `409 more_than_paid` — a refund already gave the money back) closes the confirm, says why in
 * the room's words and refreshes the ledger; any other failure keeps it open.
 */
export function PaymentDeleteConfirm({
  target,
  onClose,
  onDeleted,
  fixture = false,
}: PaymentDeleteConfirmProps) {
  const { t } = useTranslation(LEDGER_NS);
  const formatRupees = useRupeeFormat();
  const { remove, restore } = useEntryWrites(fixture);
  const queryClient = useQueryClient();
  const entry = target?.entry;
  const ref = entry ? displayId.payment(entry.seq) : '';

  /** Tell a refusal apart from a failure: the first closes the confirm and refreshes the ledger. */
  const reportFailure = (error: unknown) => {
    const block = apiErrorReason(error);
    const blockKey = block === undefined ? undefined : DELETE_BLOCK_KEYS[block];
    if (blockKey === undefined) {
      notifyError(error);
      return;
    }
    notify.error(t(blockKey, { ref }));
    queryClient
      .invalidateQueries({ queryKey: paymentQueryKeys.all })
      .catch(() => undefined);
    onClose();
  };
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
              due: formatRupees(target?.dueAfter ?? 0),
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
        try {
          await remove.mutateAsync({ id: entry.id, reason, note });
        } catch (error) {
          reportFailure(error);
          throw error;
        }
        onDeleted?.();
      }}
    />
  );
}
