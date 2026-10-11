import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import {
  ConfirmDialog,
  type ConfirmReasonChoice,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { LEDGER_KEYS, LEDGER_NS } from '@/shared/components/LedgerCells/index.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { useReversePayment } from '@/shared/hooks/usePayments/index.ts';
import { notify } from '@/shared/notify/index.ts';

const K = LEDGER_KEYS.reverseEntry;

/** The reversal's chips — the ledger's delete reasons; "Other" waits for a note. */
const REVERSE_REASONS: readonly ConfirmReasonOption[] = [
  { value: 'twice', labelKey: `${LEDGER_NS}:${LEDGER_KEYS.deleteEntry.reasons.twice}` },
  { value: 'amount', labelKey: `${LEDGER_NS}:${LEDGER_KEYS.deleteEntry.reasons.amount}` },
  { value: 'party', labelKey: `${LEDGER_NS}:${LEDGER_KEYS.deleteEntry.reasons.party}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** The API's longest reason (`reason` 1–280). */
const REASON_MAX_LENGTH = 280;

/** clinozy-be's `409` reasons for a reversal, in the room's words. */
const REVERSE_BLOCK_KEYS: Readonly<Record<string, string>> = {
  /** Reversed meanwhile (another device, a stale list), or itself a reversal. */
  already_reversed: K.blocked.alreadyReversed,
  /** Its day was reopened meanwhile: delete it instead. */
  day_open: K.blocked.dayOpen,
  /** Today's day at its branch is closed: the reversal has nowhere to go. */
  day_closed: K.blocked.dayClosed,
};

/**
 * The reason the reversal keeps (free text, 1–280 — its note on the ledger): the chip as shown
 * and the note after it ("Wrong amount · ₹500, not ₹5,000"), or the note alone for "Other".
 */
function reverseReasonOf({ picked, comment }: ConfirmReasonChoice): string {
  const reason =
    picked.value === 'other'
      ? comment
      : [picked.label, comment].filter(Boolean).join(' · ');
  return reason.slice(0, REASON_MAX_LENGTH);
}

/** Props of {@link PaymentReverseConfirm}. */
export interface PaymentReverseConfirmProps {
  /** The closed day's entry to reverse; the confirm is open while one is set. */
  entry: Pick<LedgerRow, 'id' | 'seq'> | null;
  /** "Keep it", the ×, the backdrop, Esc — and the confirm closing after the write or a refusal. */
  onClose: () => void;
}

/**
 * "Reverse this payment?" (research §2, `POST /app/payments/:payment_id/reverse`,
 * `payment:delete`): a closed day's entry is never edited or deleted — a mistake is reversed. The
 * shared reason confirm, the entry as "PAY-8" in the grey pill, the ledger's reasons (the
 * reason is the reversal's note). clinozy-be writes a `reversal` entry on today's day at the
 * entry's branch, the opposite money, and moves the invoice's paid and the credit's settled
 * back; "PAY-8 reversed · PAY-9". Final, so no Undo — the reversal is deleted on its day. A
 * refusal (`409 already_reversed`, `day_open`, `day_closed`) closes the confirm, says why in the
 * room's words and refreshes the ledger; any other failure keeps it open.
 */
export function PaymentReverseConfirm({ entry, onClose }: PaymentReverseConfirmProps) {
  const { t } = useTranslation(LEDGER_NS);
  const queryClient = useQueryClient();
  const reverse = useReversePayment({ notifyOnError: false });
  const ref = entry ? displayId.payment(entry.seq) : '';

  /** Tell a refusal apart from a failure: the first closes the confirm and refreshes the ledger. */
  const reportFailure = (error: unknown) => {
    const block = apiErrorReason(error);
    const blockKey = block === undefined ? undefined : REVERSE_BLOCK_KEYS[block];
    if (blockKey === undefined) {
      notify.error(mapApiError(error));
      return;
    }
    notify.error(t(blockKey, { ref }));
    queryClient
      .invalidateQueries({ queryKey: paymentQueryKeys.all })
      .catch(() => undefined);
    onClose();
  };

  return (
    <ConfirmDialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(K.title)}
      description={t(K.effect)}
      confirmLabel={t(K.action)}
      reason={{ record: ref, options: REVERSE_REASONS }}
      onConfirm={async (choice) => {
        if (!entry) return;
        try {
          const reversal = await reverse.mutateAsync({
            id: entry.id,
            reason: reverseReasonOf(choice),
          });
          notify.success(
            t(K.reversed, { ref, reversal: displayId.payment(reversal.seq) }),
          );
        } catch (error) {
          reportFailure(error);
          throw error;
        }
      }}
    />
  );
}
