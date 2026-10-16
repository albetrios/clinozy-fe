import { describe, expect, it } from 'vitest';

import type { InvoicePartyForm, PaidNowRow } from './invoice-form.ts';
import { paidNowReceived } from './invoice-paid-now.ts';

const PATIENT: InvoicePartyForm = {
  kind: 'patient',
  id: 'pat_kavya000000000000000',
  contactId: 'con_kavya000000000000000',
  name: 'Kavya Mehta',
  phone: '+919800000000',
};
const OUTCOME = { invoiceId: 'inv_x', seq: 6, type: 'clinic' as const, planLinked: 0 };

function received(patch: {
  kind?: 'create' | 'copy' | 'edit';
  sale?: boolean;
  party?: InvoicePartyForm | null;
  paidNow?: PaidNowRow[];
  due?: number;
}) {
  return paidNowReceived({
    kind: patch.kind ?? 'create',
    sale: patch.sale ?? false,
    values: {
      party: patch.party === undefined ? PATIENT : patch.party,
      paidNow: patch.paidNow ?? [
        { mode: 'upi', amount: 150_000 },
        { mode: 'cash', amount: 50_000 },
      ],
      branchId: null,
    },
    due: patch.due ?? 0,
    fallbackBranchId: 'brn_main',
    outcome: OUTCOME,
  });
}

describe('paidNowReceived', () => {
  it('is a patient’s payment on a new invoice, in rupees, with each mode', () => {
    expect(received({})).toEqual({
      amount: 2000,
      modes: ['upi', 'cash'],
      payerName: 'Kavya Mehta',
      paymentSeq: null,
      outcome: { kind: 'paid', invoiceSeq: 6 },
      patientId: PATIENT.id,
      contactId: PATIENT.contactId,
      branchId: 'brn_main',
    });
  });

  it('says what is still due after it', () => {
    expect(received({ due: 120_000 })?.outcome).toEqual({
      kind: 'due',
      invoiceSeq: 6,
      due: 1200,
    });
  });

  it('keeps the toast for an edit, a sale, nothing paid now, or no patient contact', () => {
    expect(received({ kind: 'edit' })).toBeNull();
    expect(received({ sale: true })).toBeNull();
    expect(received({ paidNow: [{ mode: 'upi', amount: 0 }] })).toBeNull();
    expect(received({ party: null })).toBeNull();
    expect(received({ party: { ...PATIENT, contactId: null } })).toBeNull();
    expect(received({ party: { ...PATIENT, kind: 'contact' } })).toBeNull();
  });
});
