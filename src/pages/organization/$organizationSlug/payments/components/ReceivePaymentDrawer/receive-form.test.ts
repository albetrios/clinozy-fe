import { describe, expect, it } from 'vitest';

import type { LedgerRow, OpenInvoice } from '@/shared/api/clinic/payments-contracts.ts';

import {
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

const BRANCH = '00000000-0000-4000-8000-0000000b0001';
const PATIENT = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

const invoice = (id: string, seq: number, due: number): OpenInvoice => ({
  id,
  seq,
  type: 'clinic',
  date: '2026-09-20',
  bill: due,
  paid: 0,
  due,
});

const OLDEST = invoice('inv-784', 784, 855_000);
const NEWER = invoice('inv-786', 786, 120_000);

describe('the receive form', () => {
  it('starts with no patient and one empty UPI row', () => {
    expect(emptyReceiveForm(BRANCH)).toEqual({
      branchId: BRANCH,
      patientId: null,
      invoiceId: null,
      splits: [{ mode: 'upi', amount: 0 }],
      reference: '',
      note: '',
    });
  });

  it('takes a picked patient’s oldest open invoice and its due — or the one a link names', () => {
    const base = emptyReceiveForm(BRANCH);
    expect(withPatient(base, PATIENT, [OLDEST, NEWER])).toMatchObject({
      patientId: PATIENT,
      invoiceId: 'inv-784',
      splits: [{ mode: 'upi', amount: 855_000 }],
    });
    expect(withPatient(base, PATIENT, [OLDEST, NEWER], 'inv-786').invoiceId).toBe(
      'inv-786',
    );
    // Nothing due: no invoice, a 0 row in the mode already chosen.
    const cash = { ...base, splits: [{ mode: 'cash' as const, amount: 0 }] };
    expect(withPatient(cash, PATIENT, [])).toMatchObject({
      invoiceId: null,
      splits: [{ mode: 'cash', amount: 0 }],
    });
  });

  it('fills Full, Half and Cash + UPI from a due, half in whole rupees', () => {
    expect(halfOf(855_000)).toBe(427_500);
    expect(halfOf(70_100)).toBe(35_100);
    expect(quickFillSplits('full', 855_000)).toEqual([{ mode: 'upi', amount: 855_000 }]);
    expect(quickFillSplits('half', 855_000)).toEqual([{ mode: 'upi', amount: 427_500 }]);
    expect(quickFillSplits('cashUpi', 855_000)).toEqual([
      { mode: 'cash', amount: 427_500 },
      { mode: 'upi', amount: 427_500 },
    ]);
  });

  it('tones the mode badge: one mode in its own tone, a split in stone', () => {
    expect(modesTone(['upi'])).toBe('sage');
    expect(modesTone(['cash', 'upi'])).toBe('stone');
  });

  it('checks a patient first, then an amount, then at most the invoice’s due', () => {
    const base = emptyReceiveForm(BRANCH);
    expect(receiveProblem(base, null)).toEqual({ kind: 'patient', field: 'patientId' });
    const picked = withPatient(base, PATIENT, [OLDEST]);
    expect(
      receiveProblem({ ...picked, splits: [{ mode: 'upi', amount: 0 }] }, 855_000),
    ).toEqual({ kind: 'amount', field: 'splits' });
    expect(
      receiveProblem({ ...picked, splits: [{ mode: 'upi', amount: 855_100 }] }, 855_000),
    ).toEqual({ kind: 'aboveDue', field: 'splits', due: 855_000 });
    expect(receiveProblem(picked, 855_000)).toBeNull();
    // No invoice: any amount above zero.
    expect(receiveProblem({ ...picked, invoiceId: null }, null)).toBeNull();
  });

  it('sends the paid rows only, Reference and Note trimmed to null when empty', () => {
    const values = {
      ...withPatient(emptyReceiveForm(null), PATIENT, [OLDEST]),
      splits: [
        { mode: 'cash' as const, amount: 300_000 },
        { mode: null, amount: 1 },
        { mode: 'upi' as const, amount: 0 },
      ],
      reference: ' 4321 ',
      note: '  ',
    };
    expect(receiveInputOf(values, BRANCH)).toEqual({
      branchId: BRANCH,
      patientId: PATIENT,
      invoiceId: 'inv-784',
      splits: [{ mode: 'cash', amount: 300_000 }],
      reference: '4321',
      note: null,
    });
    expect(receivePatchOf(values)).toEqual({
      splits: [{ mode: 'cash', amount: 300_000 }],
      reference: '4321',
      note: null,
    });
  });

  it('opens a receipt as its edit form', () => {
    const entry = {
      branchId: BRANCH,
      patientId: PATIENT,
      invoiceId: 'inv-784',
      splits: [
        { mode: 'upi', amount: 60_000 },
        { mode: 'credit', amount: 10_000 },
      ],
      reference: null,
      note: 'At the desk',
    } as unknown as LedgerRow;
    expect(receiveFormOf(entry)).toEqual({
      branchId: BRANCH,
      patientId: PATIENT,
      invoiceId: 'inv-784',
      splits: [
        { mode: 'upi', amount: 60_000 },
        { mode: null, amount: 10_000 },
      ],
      reference: '',
      note: 'At the desk',
    });
  });
});
