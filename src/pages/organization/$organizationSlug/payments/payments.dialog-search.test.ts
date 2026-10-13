import { describe, expect, it } from 'vitest';

import {
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
} from './payments.dialog-search.ts';

const PATIENT = 'pat_9e6j52vjb8uhvz44ebe94';
const INVOICE = 'invc_4ea44s81zsxncy705mp01';
const BRANCH = 'brn_53j4b7hz7nfb0otr2d920';
const STOCK_PURCHASE = 'spur_0irgmlbrv8akvoipmawa8';
const MEDICAL_ORDER = 'mpo_0irgmlbrv8akvoipmawa8';
const OLD_UUID = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('the dialog routes’ params', () => {
  it('Receive: a patient and an invoice by public id, and `from` kept as text (S:85)', () => {
    expect(
      validatePaymentReceiveSearch({ patient: PATIENT, invoice: INVOICE, from: 'today' }),
    ).toEqual({ patient: PATIENT, invoice: INVOICE, from: 'today' });
    expect(
      validatePaymentReceiveSearch({ patient: OLD_UUID, invoice: 'INV-785' }),
    ).toEqual({ patient: undefined, invoice: undefined, from: undefined });
    expect(validatePaymentReceiveSearch({ from: '' }).from).toBeUndefined();
  });

  it('Pay: a Clinic stock purchase or a Medical PO by its public id (S:86)', () => {
    expect(validatePaymentPaySearch({ bill: STOCK_PURCHASE })).toEqual({
      bill: STOCK_PURCHASE,
    });
    expect(validatePaymentPaySearch({ bill: MEDICAL_ORDER })).toEqual({
      bill: MEDICAL_ORDER,
    });
    expect(validatePaymentPaySearch({ bill: `md:${OLD_UUID}` })).toEqual({
      bill: undefined,
    });
    expect(validatePaymentPaySearch({ bill: INVOICE })).toEqual({ bill: undefined });
  });

  it('Day close: a calendar date and a branch by public id (S:91)', () => {
    expect(validateDayCloseSearch({ date: '2026-10-02', branch: BRANCH })).toEqual({
      date: '2026-10-02',
      branch: BRANCH,
    });
    expect(validateDayCloseSearch({ date: '2 Oct', branch: OLD_UUID })).toEqual({
      date: undefined,
      branch: undefined,
    });
  });
});
