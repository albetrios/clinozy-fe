import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { listOpenInvoices, paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useSettleCredit } from '@/shared/hooks/useCredits/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';

const K = PAYMENTS_KEYS.pending;

/** Whether a credit can go on the patient's next bill: an open Give credit of a patient (Q-G9). */
export const canUseOnBill = (
  credit: Pick<CreditRow, 'status' | 'direction' | 'patientId'>,
) => credit.status === 'open' && credit.direction === 'give' && credit.patientId !== null;

/**
 * Use on next bill (Q-G9; PRD.md:88; `settleCredit` `use_on_bill`, `S:1713`):
 * min(credit, due) goes on the patient's oldest invoice with a due, as a
 * Credit-mode receipt — "₹500 of CR-2 adjusted on invoice #785". Nothing due
 * says so before anything is written: "Nothing due for Tanvi Shah to adjust
 * against". In full the row reads "Adjusted · Invoice #785"; in part, "₹X
 * adjusted".
 */
export function useCreditOnBill(): (credit: CreditRow) => Promise<void> {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const queryClient = useQueryClient();
  const settle = useSettleCredit({ notifyOnError: false });

  return async (credit) => {
    const patientId = credit.patientId ?? '';
    try {
      const open = await queryClient.query({
        queryKey: paymentQueryKeys.openInvoices(patientId),
        queryFn: () => listOpenInvoices(patientId),
      });
      if (open.length === 0) {
        notify.info(t(K.nothingDue, { name: credit.partyName }));
        return;
      }
      const result = await settle.mutateAsync({
        id: credit.id,
        settlement: { action: 'use_on_bill' },
      });
      notify.success(
        t(K.adjustedOn, {
          amount: formatPaise(result.amount),
          ref: displayId.pendingCredit(credit.seq),
          seq: result.invoiceSeq,
        }),
      );
    } catch (error) {
      notify.error(mapApiError(error));
    }
  };
}
