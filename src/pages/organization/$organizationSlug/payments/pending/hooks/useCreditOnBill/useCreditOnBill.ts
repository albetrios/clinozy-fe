import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { invoiceQueryKeys, listOpenInvoices } from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { useSettleCredit } from '@/shared/hooks/useCredits/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';

const K = PAYMENTS_KEYS.pending;

/** Whether a credit can go on the patient's next bill: an open Give credit of a patient (Q-G9). */
export const canUseOnBill = (
  credit: Pick<CreditRow, 'status' | 'direction' | 'patientId'>,
) => credit.status === 'open' && credit.direction === 'give' && credit.patientId !== null;

/** What goes on a bill: what is left of the credit, at most the invoice's due — in rupees. */
const onBillAmount = (
  credit: Pick<CreditRow, 'left'>,
  invoice: Pick<InvoiceRecord, 'due'>,
) => rupeesOfPaise(Math.min(paiseOfRupees(credit.left), paiseOfRupees(invoice.due)));

/**
 * A refusal in the room's words: the day at the invoice's branch is closed (`day_closed` — a use
 * on a bill lands there, now), nothing due on it any more (`nothing_due`), its due went down
 * meanwhile (`more_than_due`), the credit settled in full meanwhile (`credit_closed`); any other
 * says the server's reason.
 */
function refusalOf({
  error,
  credit,
  invoice,
  t,
}: {
  error: unknown;
  credit: CreditRow;
  invoice: InvoiceRecord;
  t: TFunction;
}): string {
  const reason = apiErrorReason(error);
  const ref = displayId.pendingCredit(credit.seq);
  if (reason === 'day_closed') return t(K.conflicts.dayClosed, { seq: invoice.seq });
  if (reason === 'nothing_due') return t(K.nothingDue, { name: credit.partyName });
  if (reason === 'more_than_due') return t(K.conflicts.dueChanged, { seq: invoice.seq });
  if (reason === 'credit_closed') return t(K.conflicts.closed, { ref });
  return mapApiError(error);
}

/**
 * Use on next bill (Q-G9; PRD.md:88; `POST /app/pending-credits/:id/settle`, `method:
 * use_on_bill`): what is left of the credit, at most the due, goes on the patient's oldest
 * invoice with a due (read fresh, `GET /app/invoices?patient_id=&payment_status=unpaid,partial`,
 * oldest first) as a Credit-mode receipt — it lands at that invoice's branch, now — "₹500 of
 * CR-2 adjusted on invoice #785". Nothing due says so before anything is written: "Nothing due
 * for Tanvi Shah to adjust against". A closed day at that branch is refused (`409 day_closed`),
 * in the room's words. In full the row reads "Adjusted"; in part, "₹X adjusted".
 */
export function useCreditOnBill(): (credit: CreditRow) => Promise<void> {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const settle = useSettleCredit({ notifyOnError: false });

  const openInvoicesOf = (patientId: string) =>
    queryClient.query({
      queryKey: invoiceQueryKeys.every(organizationId, {
        patientId,
        status: ['unpaid', 'partial'],
        oldestFirst: true,
      }),
      queryFn: () => listOpenInvoices(patientId),
      // The due decides the amount: never a cached one.
      staleTime: 0,
    });

  return async (credit) => {
    let invoice: InvoiceRecord | undefined;
    try {
      [invoice] = await openInvoicesOf(credit.patientId ?? '');
    } catch (error) {
      notify.error(mapApiError(error));
      return;
    }
    if (!invoice) {
      notify.info(t(K.nothingDue, { name: credit.partyName }));
      return;
    }
    const amount = onBillAmount(credit, invoice);
    try {
      const result = await settle.mutateAsync({
        credit,
        settlement: { action: 'use_on_bill', invoiceId: invoice.id, amount },
      });
      notify.success(
        t(K.adjustedOn, {
          amount: formatRupees(result.amount),
          ref: displayId.pendingCredit(credit.seq),
          seq: invoice.seq,
        }),
      );
    } catch (error) {
      notify.error(refusalOf({ error, credit, invoice, t }));
    }
  };
}
