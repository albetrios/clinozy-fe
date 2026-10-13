import { describe, expect, it } from 'vitest';

import {
  invoiceRecord,
  ledgerRow,
  TEST_INVOICE_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  dueInPaise,
  emptyReceiveForm,
  halfOf,
  modesTone,
  quickFillSplits,
  receiveFormOf,
  receiveInputOf,
  receivePatchOf,
  receiveProblem,
  withPatient,
} from './receive-form.ts';

const KAVYA = { id: TEST_MONEY_PATIENT_ID, contactId: TEST_MONEY_CONTACT_ID };

/** Kavya's invoice #5 (₹100 due) and an older one (₹1,250.50 due). */
const OPEN = [
  invoiceRecord({ id: 'invc_older0000000000000001', seq: 4, due: 1250.5 }),
  invoiceRecord(),
];

describe('the receive form', () => {
  it('starts with no patient and one empty UPI row', () => {
    expect(emptyReceiveForm(TEST_MONEY_BRANCH_ID)).toEqual({
      branchId: TEST_MONEY_BRANCH_ID,
      patientId: null,
      contactId: null,
      invoiceId: null,
      splits: [{ mode: 'upi', amount: 0 }],
      reference: '',
      note: '',
    });
  });

  it('takes a picked patient’s contact, their oldest open invoice and its due in paise — or the one a link names', () => {
    const picked = withPatient(emptyReceiveForm(null), KAVYA, OPEN);
    expect(picked).toMatchObject({
      patientId: TEST_MONEY_PATIENT_ID,
      contactId: TEST_MONEY_CONTACT_ID,
      invoiceId: 'invc_older0000000000000001',
      splits: [{ mode: 'upi', amount: 125_050 }],
    });
    expect(withPatient(picked, KAVYA, OPEN, TEST_INVOICE_ID)).toMatchObject({
      invoiceId: TEST_INVOICE_ID,
      splits: [{ amount: 10_000 }],
    });
    // Nothing open: an advance, from a 0 row.
    expect(withPatient(picked, KAVYA, [])).toMatchObject({
      invoiceId: null,
      splits: [{ amount: 0 }],
    });
    expect(dueInPaise({ due: 0.1 + 0.2 })).toBe(30);
  });

  it('fills Full, Half and Cash + UPI from a due, half in whole rupees', () => {
    expect(halfOf(855_000)).toBe(427_500);
    expect(halfOf(70_100)).toBe(35_100);
    expect(quickFillSplits('full', 70_000)).toEqual([{ mode: 'upi', amount: 70_000 }]);
    expect(quickFillSplits('half', 70_000)).toEqual([{ mode: 'upi', amount: 35_000 }]);
    expect(quickFillSplits('cashUpi', 70_100)).toEqual([
      { mode: 'cash', amount: 35_100 },
      { mode: 'upi', amount: 35_000 },
    ]);
  });

  it('tones the mode badge: one mode in its own tone, a split in stone', () => {
    expect(modesTone(['upi'])).toBe('sage');
    expect(modesTone(['cash', 'upi'])).toBe('stone');
  });

  it('checks a patient first, then an amount, then at most the invoice’s due', () => {
    const empty = emptyReceiveForm(null);
    expect(receiveProblem(empty, null)).toEqual({ kind: 'patient', field: 'patientId' });
    const picked = { ...withPatient(empty, KAVYA, []), splits: [] };
    expect(receiveProblem(picked, null)).toEqual({ kind: 'amount', field: 'splits' });
    const above = { ...picked, splits: [{ mode: 'upi' as const, amount: 20_000 }] };
    expect(receiveProblem(above, 10_000)).toEqual({
      kind: 'aboveDue',
      field: 'splits',
      due: 10_000,
    });
    // An advance has no due to stay under.
    expect(receiveProblem(above, null)).toBeNull();
  });

  it('sends the contact, the paid rows in rupees, and Reference and Note as typed (trimmed on the wire)', () => {
    const values = {
      ...withPatient(emptyReceiveForm(null), KAVYA, OPEN, TEST_INVOICE_ID),
      splits: [
        { mode: 'cash' as const, amount: 5_050 },
        { mode: 'upi' as const, amount: 0 },
        { mode: null, amount: 1_000 },
      ],
      reference: ' 4321 ',
      note: '',
    };
    expect(receiveInputOf(values, TEST_MONEY_BRANCH_ID)).toEqual({
      branchId: TEST_MONEY_BRANCH_ID,
      contactId: TEST_MONEY_CONTACT_ID,
      invoiceId: TEST_INVOICE_ID,
      splits: [{ mode: 'cash', amount: 50.5 }],
      reference: ' 4321 ',
      note: '',
    });
    expect(receivePatchOf(values)).toEqual({
      splits: [{ mode: 'cash', amount: 50.5 }],
      reference: ' 4321 ',
      note: '',
    });
  });

  it('opens a receipt as its edit form, its rows in paise', () => {
    expect(receiveFormOf(ledgerRow())).toEqual({
      branchId: TEST_MONEY_BRANCH_ID,
      patientId: TEST_MONEY_PATIENT_ID,
      contactId: TEST_MONEY_CONTACT_ID,
      invoiceId: TEST_INVOICE_ID,
      splits: [
        { mode: 'cash', amount: 10_000 },
        { mode: 'upi', amount: 5_000 },
      ],
      reference: 'REF9',
      note: 'At the desk',
    });
  });
});
