import { describe, expect, it } from 'vitest';

import {
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_MODE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import { LEDGER_KIND_VALUES } from '@/shared/api/clinic/payments-contracts.ts';
import { roomFilterValues } from '@/shared/components/RoomToolbar/RoomFilters/room-filters.ts';

import { LEDGER_FILTER_FIELDS } from './payments.constants.ts';
import {
  LEDGER_FILTER_VALUES,
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
  validatePaymentsSearch,
} from './payments.search.ts';

const PATIENT = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';
const PO = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('the contract’s values, declared for the entry chunk', () => {
  it('match the contract’s enums', () => {
    expect(LEDGER_FILTER_VALUES.direction).toEqual(PAYMENT_DIRECTION_VALUES);
    expect(LEDGER_FILTER_VALUES.kind).toEqual(LEDGER_KIND_VALUES);
    expect(LEDGER_FILTER_VALUES.mode).toEqual(PAYMENT_MODE_VALUES);
  });
});

describe('validatePaymentsSearch (S:84)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validatePaymentsSearch({
        direction: 'paid',
        kind: 'expense,refund',
        mode: ['cash', 'upi'],
        created: 'last_7',
        q: '  PAY-5512 ',
      }),
    ).toEqual({
      direction: 'paid',
      kind: ['expense', 'refund'],
      mode: ['cash', 'upi'],
      created: 'last_7',
      q: 'PAY-5512',
    });
  });

  it('drops what it can’t hold — and the schema’s unused followUp and sort', () => {
    const search = validatePaymentsSearch({
      direction: 'sideways',
      kind: ['reversal', 'receipt'],
      mode: 'cheque',
      created: 'someday',
      q: 'x'.repeat(200),
      followUp: 'today',
      sort: 'amount:desc',
    });
    expect(search).toEqual({
      direction: undefined,
      kind: ['receipt'],
      mode: undefined,
      created: undefined,
      q: 'x'.repeat(80),
    });
    expect(Object.keys(validatePaymentsSearch({}))).toEqual([
      'direction',
      'kind',
      'mode',
      'created',
      'q',
    ]);
  });

  it('reads back into the Filters popover through the shared readers', () => {
    expect(
      roomFilterValues(
        LEDGER_FILTER_FIELDS,
        validatePaymentsSearch({ direction: 'received', mode: 'card' }),
      ),
    ).toEqual({ direction: ['received'], mode: ['card'] });
  });
});

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
