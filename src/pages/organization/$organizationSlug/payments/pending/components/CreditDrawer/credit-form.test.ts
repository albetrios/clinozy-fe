import { describe, expect, it } from 'vitest';

import {
  creditRow,
  TEST_INVOICE_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  creditAmount,
  creditFormOf,
  creditInputOf,
  creditProblem,
  emptyCreditForm,
  partyByName,
  partyOf,
  reasonsOf,
  reasonTone,
  withDirection,
  withParty,
} from './credit-form.ts';

/** Kavya Mehta as the Who picker keeps her: her file and her contact. */
const KAVYA = {
  key: `patient:${TEST_MONEY_PATIENT_ID}`,
  name: 'Kavya Mehta',
  contactId: TEST_MONEY_CONTACT_ID,
  patientId: TEST_MONEY_PATIENT_ID,
};

/** A walk-in's contact, no patient file. */
const WALK_IN = 'con_walkin00000000000000001';

/** CR-1 with a reason no chip has — stored by the API as free text. */
const FREE_TEXT = creditRow({
  amount: 1_250.5,
  reason: 'Charged twice for corn removal',
  reasonKey: 'other',
  note: null,
});

describe('the credit form (payments.md:152–168)', () => {
  it('starts on Give — or the way a link names — with nothing else filled', () => {
    expect(emptyCreditForm()).toEqual({
      direction: 'give',
      party: null,
      amount: '',
      reasonKey: null,
      invoiceId: null,
      settleBy: null,
      note: '',
    });
    expect(emptyCreditForm('take').direction).toBe('take');
  });

  it('keys a patient by file, a contact by contact, a supplier by name — typed or listed alike', () => {
    expect(
      partyOf({
        kind: 'patient',
        contactId: TEST_MONEY_CONTACT_ID,
        patientId: TEST_MONEY_PATIENT_ID,
        seq: 2,
        name: 'Kavya Mehta',
        phone: '+919825005865',
      }),
    ).toEqual(KAVYA);
    expect(
      partyOf({ kind: 'contact', contactId: WALK_IN, name: 'Ravi Patel', phone: '' }),
    ).toEqual({
      key: `contact:${WALK_IN}`,
      name: 'Ravi Patel',
      contactId: WALK_IN,
      patientId: null,
    });
    expect(partyOf({ kind: 'vendor', id: 'svnd_x', name: 'Medline Surgicals' })).toEqual(
      partyByName('  Medline Surgicals '),
    );
    expect(partyByName('Medline Surgicals')).toEqual({
      key: 'name:medline-surgicals',
      name: 'Medline Surgicals',
      contactId: null,
      patientId: null,
    });
  });

  it('opens an open credit as its form — the amount typed in rupees', () => {
    expect(creditFormOf(creditRow())).toEqual({
      direction: 'give',
      party: KAVYA,
      amount: '80',
      reasonKey: 'overpaid',
      invoiceId: TEST_INVOICE_ID,
      settleBy: '2026-10-20',
      note: 'Paid twice at the desk',
    });
    expect(
      creditFormOf(
        creditRow({
          contactId: null,
          contact: null,
          patientId: null,
          partyName: 'Medline',
        }),
      ).party,
    ).toEqual(partyByName('Medline'));
  });

  it('opens a free-text reason as "Other" with the text as its note, so a save keeps it', () => {
    expect(creditFormOf(FREE_TEXT)).toMatchObject({
      amount: '1250.5',
      reasonKey: 'other',
      note: 'Charged twice for corn removal',
    });
    expect(creditFormOf({ ...FREE_TEXT, note: 'Paid for a friend' }).note).toBe(
      'Paid for a friend',
    );
  });

  it('drops the reason with the way, and the invoice with the party', () => {
    const picked = {
      ...emptyCreditForm(),
      party: KAVYA,
      reasonKey: 'overpaid' as const,
      invoiceId: TEST_INVOICE_ID,
    };
    expect(withDirection(picked, 'give')).toBe(picked);
    expect(withDirection(picked, 'take')).toMatchObject({
      direction: 'take',
      reasonKey: null,
    });
    expect(withParty(picked, KAVYA)).toBe(picked);
    expect(withParty(picked, partyByName('Medline Surgicals'))).toMatchObject({
      invoiceId: null,
    });
  });

  it('offers each way’s reasons, toned by their place', () => {
    expect(reasonsOf('give')).toEqual([
      'charged_twice',
      'advance_not_used',
      'package_cancelled',
      'overpaid',
      'returned_items',
      'other',
    ]);
    expect(reasonsOf('take')).toContain('loan_to_staff');
    expect(reasonTone('give', 'charged_twice')).toBe('butter');
    expect(reasonTone('give', 'other')).toBe('stone');
    expect(reasonTone('take', 'damaged_goods')).toBe('sky');
  });

  it('checks who, then the amount, then a reason, then "Other"’s note', () => {
    const empty = emptyCreditForm();
    expect(creditProblem(empty)).toEqual({ kind: 'who', field: 'party' });
    const who = { ...empty, party: KAVYA };
    expect(creditProblem(who)).toEqual({ kind: 'amount', field: 'amount' });
    const amount = { ...who, amount: '500' };
    expect(creditAmount(amount)).toBe(50_000);
    expect(creditProblem(amount)).toEqual({ kind: 'reason', field: 'reasonKey' });
    const other = { ...amount, reasonKey: 'other' as const };
    expect(creditProblem(other)).toEqual({ kind: 'otherNote', field: 'note' });
    expect(creditProblem({ ...other, note: 'Paid for a friend' })).toBeNull();
  });

  it('sends the contact and the amount in rupees, and an invoice only for a person', () => {
    const values = {
      ...emptyCreditForm(),
      party: KAVYA,
      amount: '500.25',
      reasonKey: 'charged_twice' as const,
      invoiceId: TEST_INVOICE_ID,
      settleBy: '2026-10-20',
      note: '  ',
    };
    expect(creditInputOf(values)).toEqual({
      direction: 'give',
      contactId: TEST_MONEY_CONTACT_ID,
      partyName: 'Kavya Mehta',
      amount: 500.25,
      reasonKey: 'charged_twice',
      invoiceId: TEST_INVOICE_ID,
      settleBy: '2026-10-20',
      note: null,
    });
    expect(
      creditInputOf({ ...values, party: partyByName('Medline Surgicals') }),
    ).toMatchObject({ contactId: null, partyName: 'Medline Surgicals', invoiceId: null });
  });
});
