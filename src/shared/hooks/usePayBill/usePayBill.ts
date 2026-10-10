import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { organizationPaymentPay } from '@/lib/routes/payments-builders.ts';
import {
  supplierBillKey,
  type SupplierBillRef,
} from '@/shared/api/clinic/payments-contracts.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';

/** What {@link usePayBill} hands a room: whether "Pay ₹X" shows, and what it opens. */
export interface PayBill {
  /** The member may record a payment and open Payments to do it (`payment:create` + `payment:read`). */
  canPay: boolean;
  /** Payments › Send payment on this bill — `/payments/pay?bill=<mpo_… | spur_…>`. */
  pay: (bill: SupplierBillRef) => void;
}

/**
 * "Pay ₹X" in the rooms that buy (Q-M1; KICKOFF §6.7–§6.8): every supplier bill
 * is paid through Payments › Send payment on `?bill=` with the purchase's
 * public id — `mpo_…` (a Medical PO) or `spur_…` (a Clinic stock purchase) — so
 * the money reaches the ledger and Day close. The action shows only to members
 * who may record a payment and see the Payments room it opens (`payment:create` and
 * `payment:read` — a Pharmacist holds the first alone, PAY-M3).
 */
export function usePayBill(): PayBill {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const access = usePaymentAccess();
  const pay = useCallback(
    (bill: SupplierBillRef) =>
      void navigate({
        ...organizationPaymentPay(organizationSlug),
        search: { bill: supplierBillKey(bill) },
      }),
    [navigate, organizationSlug],
  );
  return { canPay: access.canCreate && access.canRead, pay };
}
