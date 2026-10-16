import { rupeesOfPaise } from '@/lib/number-text.ts';
import type { ReceivedPayment } from '@/shared/components/PaymentReceived/index.ts';

import { type InvoiceFormValues, paidNowSplits, paidNowTotal } from './invoice-form.ts';
import type { InvoiceDrawerOutcome } from './use-invoice-drawer.ts';

/**
 * A new clinic or consultation invoice saved with "Paid now" for a patient, as Payment received
 * shows it (`feat-payment-celebration` D9) — or null: an edit, a Medical sale, nothing paid now,
 * or no patient's contact keep the save's toast. `due` is what the invoice still needs after the
 * payment (paise, the drawer's figures). clinozy-be does not return the receipt's number on an
 * invoice create, so the view names the modes alone.
 */
export function paidNowReceived({
  kind,
  sale,
  values,
  due,
  fallbackBranchId,
  outcome,
}: {
  kind: 'create' | 'copy' | 'edit';
  sale: boolean;
  values: Pick<InvoiceFormValues, 'party' | 'paidNow' | 'branchId'>;
  due: number;
  fallbackBranchId: string;
  outcome: InvoiceDrawerOutcome;
}): ReceivedPayment | null {
  const { party } = values;
  const paid = paidNowTotal(values.paidNow);
  if (kind === 'edit' || sale || paid <= 0) return null;
  if (party?.kind !== 'patient' || party.contactId === null) return null;
  return {
    amount: rupeesOfPaise(paid),
    modes: paidNowSplits(values.paidNow).map((split) => split.mode),
    payerName: party.name,
    paymentSeq: null,
    outcome:
      due > 0
        ? { kind: 'due', invoiceSeq: outcome.seq, due: rupeesOfPaise(due) }
        : { kind: 'paid', invoiceSeq: outcome.seq },
    patientId: party.id,
    contactId: party.contactId,
    branchId: values.branchId ?? fallbackBranchId,
  };
}
