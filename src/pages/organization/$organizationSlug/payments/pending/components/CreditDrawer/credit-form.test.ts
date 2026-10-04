import { describe, expect, it } from 'vitest';

import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';

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

const PATIENT = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';
const INVOICE = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

const TANVI = { key: `patient:${PATIENT}`, name: 'Tanvi Shah', patientId: PATIENT };

/** CR-2 as Pending reads it: a seeded credit, its reason free text. */
const SEEDED: CreditRow = {
  id: '00000000-0000-4000-8000-00000000c002',
  seq: 2,
  direction: 'give',
  partyName: 'Tanvi Shah',
  patientId: PATIENT,
  amount: 50_000,
  reason: 'Charged twice for corn removal',
  sourcePaymentId: null,
  status: 'open',
  settledPaymentId: null,
  reasonKey: null,
  note: null,
  invoiceId: null,
  settleBy: null,
  adjusted: 0,
  settledAt: null,
  patientSeq: 198,
  source: null,
  invoiceSeq: null,
  settledInvoiceSeq: null,
  organizationId: '00000000-0000-4000-8000-0000000000a1',
  createdAt: '2026-06-04T05:35:00Z',
  updatedAt: '2026-06-04T05:35:00Z',
  createdById: '00000000-0000-4000-8000-0000000000b1',
  deletedAt: null,
  deleteReason: null,
  deleteNote: null,
};

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

  it('keys a patient by id and anyone else by name, typed or listed alike', () => {
    expect(
      partyOf({
        kind: 'patient',
        id: PATIENT,
        seq: 198,
        name: 'Tanvi Shah',
        phone: null,
      }),
    ).toEqual(TANVI);
    expect(partyOf({ kind: 'vendor', id: 'v', name: 'Medline Surgicals' })).toEqual(
      partyByName('  Medline Surgicals '),
    );
    expect(partyByName('Medline Surgicals').key).toBe('name:medline-surgicals');
  });

  it('opens a seeded credit’s free-text reason as "Other" with the text as its note', () => {
    expect(creditFormOf(SEEDED)).toEqual({
      direction: 'give',
      party: TANVI,
      amount: '500',
      reasonKey: 'other',
      invoiceId: null,
      settleBy: null,
      note: 'Charged twice for corn removal',
    });
    const chipped = { ...SEEDED, reasonKey: 'overpaid' as const, note: 'Paid twice' };
    expect(creditFormOf(chipped)).toMatchObject({
      reasonKey: 'overpaid',
      note: 'Paid twice',
    });
  });

  it('drops the reason with the way, and the invoice with the party', () => {
    const picked = {
      ...emptyCreditForm(),
      party: TANVI,
      reasonKey: 'overpaid' as const,
      invoiceId: INVOICE,
    };
    expect(withDirection(picked, 'give')).toBe(picked);
    expect(withDirection(picked, 'take')).toMatchObject({
      direction: 'take',
      reasonKey: null,
    });
    expect(withParty(picked, TANVI)).toBe(picked);
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
    const who = { ...empty, party: TANVI };
    expect(creditProblem(who)).toEqual({ kind: 'amount', field: 'amount' });
    const amount = { ...who, amount: '500' };
    expect(creditAmount(amount)).toBe(50_000);
    expect(creditProblem(amount)).toEqual({ kind: 'reason', field: 'reasonKey' });
    const other = { ...amount, reasonKey: 'other' as const };
    expect(creditProblem(other)).toEqual({ kind: 'otherNote', field: 'note' });
    expect(creditProblem({ ...other, note: 'Paid for a friend' })).toBeNull();
  });

  it('sends the party, the amount in paise and an invoice only for a patient', () => {
    const values = {
      ...emptyCreditForm(),
      party: TANVI,
      amount: '500',
      reasonKey: 'charged_twice' as const,
      invoiceId: INVOICE,
      settleBy: '2026-10-10',
      note: '  ',
    };
    expect(creditInputOf(values)).toEqual({
      direction: 'give',
      partyName: 'Tanvi Shah',
      patientId: PATIENT,
      amount: 50_000,
      reasonKey: 'charged_twice',
      invoiceId: INVOICE,
      settleBy: '2026-10-10',
      note: null,
    });
    expect(
      creditInputOf({ ...values, party: partyByName('Medline Surgicals') }),
    ).toMatchObject({ partyName: 'Medline Surgicals', patientId: null, invoiceId: null });
  });
});
