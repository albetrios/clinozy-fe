import { useTranslation } from 'react-i18next';

import type { OpenSupplierBill } from '@/shared/api/app/payments-contracts.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';

const K = PAYMENTS_KEYS.send;

/** A bill's age on its sub line and chip: "8 days pending", or "Today". */
export function useBillAge(): (days: number) => string {
  const { t } = useTranslation(PAYMENTS_NS);
  return (days) => (days > 0 ? t(K.daysPending, { count: days }) : t(K.pendingToday));
}

/** A bill as "Medical PO #431 · Shree Ramdev Medical Agency". */
export function useBillLabel(): (
  bill: Pick<OpenSupplierBill, 'kind' | 'seq' | 'supplierName'>,
) => string {
  const { t } = useTranslation(PAYMENTS_NS);
  return (bill) =>
    t(bill.kind === 'medical_po' ? K.billLabel.medical : K.billLabel.stock, {
      seq: bill.seq,
      supplier: bill.supplierName,
    });
}
