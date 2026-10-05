import { describe, expect, it } from 'vitest';

import {
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
} from './payments.dialog-search.ts';

const PATIENT = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';
const PO = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('the dialog routes’ params', () => {
  it('Receive: a patient and an invoice id, and `from` kept as text (S:85)', () => {
    expect(
      validatePaymentReceiveSearch({
        patient: PATIENT,
        invoice: 'INV-785',
        from: 'today',
      }),
    ).toEqual({ patient: PATIENT, invoice: undefined, from: 'today' });
    expect(validatePaymentReceiveSearch({ from: '' }).from).toBeUndefined();
  });

  it('Pay: a Medical or Clinic stock bill, `md:` / `is:` and an id (S:86)', () => {
    expect(validatePaymentPaySearch({ bill: `md:${PO}` })).toEqual({ bill: `md:${PO}` });
    expect(validatePaymentPaySearch({ bill: `is:${PO}` })).toEqual({ bill: `is:${PO}` });
    expect(validatePaymentPaySearch({ bill: `po:${PO}` })).toEqual({ bill: undefined });
    expect(validatePaymentPaySearch({ bill: PO })).toEqual({ bill: undefined });
  });

  it('Day close: a calendar date and a branch id (S:91)', () => {
    expect(validateDayCloseSearch({ date: '2026-10-02', branch: PATIENT })).toEqual({
      date: '2026-10-02',
      branch: PATIENT,
    });
    expect(validateDayCloseSearch({ date: '2 Oct', branch: 'main' })).toEqual({
      date: undefined,
      branch: undefined,
    });
  });
});
