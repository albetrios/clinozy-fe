import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { organizationPaymentPay } from '@/lib/routes/payments-builders.ts';
import {
  supplierBillKey,
  type SupplierBillRef,
} from '@/shared/api/clinic/payments-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/** What {@link usePayBill} hands a room: whether "Pay ₹X" shows, and what it opens. */
export interface PayBill {
  /** The member may record a payment (Payments Create). */
  canPay: boolean;
  /** Payments › Send payment on this bill — `/payments/pay?bill=md:<id>`. */
  pay: (bill: SupplierBillRef) => void;
}

/**
 * "Pay ₹X" in the rooms that buy (Q-M1; KICKOFF §6.7–§6.8): every supplier bill
 * is paid through Payments › Send payment on `?bill=md:<poId>` (a Medical PO) or
 * `?bill=is:<purchaseId>` (a Clinic stock purchase), so the money reaches the
 * ledger and Day close. The action shows only to members who may record a
 * payment.
 */
export function usePayBill(): PayBill {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const access = useClinicAccess();
  const pay = useCallback(
    (bill: SupplierBillRef) =>
      void navigate({
        ...organizationPaymentPay(organizationSlug),
        search: { bill: supplierBillKey(bill) },
      }),
    [navigate, organizationSlug],
  );
  return { canPay: access.isResolved && access.can('payments', 'create'), pay };
}
