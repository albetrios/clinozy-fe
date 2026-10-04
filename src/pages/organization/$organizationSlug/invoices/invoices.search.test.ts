import { describe, expect, it } from 'vitest';

import { INVOICE_TYPE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  INVOICE_TYPE_PARAMS,
  validateInvoiceCreateSearch,
  validateInvoiceSearch,
} from './invoices.search.ts';

const PATIENT = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

describe('the contract’s values, declared for the entry chunk', () => {
  it('name every invoice type, in the switch’s order', () => {
    expect([...INVOICE_TYPE_PARAMS].sort()).toEqual([...INVOICE_TYPE_VALUES].sort());
  });
});

describe('validateInvoiceCreateSearch (S:92)', () => {
  it('keeps the type, the patient and the room to go back to', () => {
    expect(
      validateInvoiceCreateSearch({
        type: 'medical',
        patient: PATIENT,
        from: ' patients/x/invoices ',
      }),
    ).toEqual({ type: 'medical', patient: PATIENT, from: 'patients/x/invoices' });
  });

  it('drops what it can’t hold, never failing', () => {
    expect(
      validateInvoiceCreateSearch({ type: 'pharmacy', patient: '3508', from: '' }),
    ).toEqual({ type: undefined, patient: undefined, from: undefined });
    expect(validateInvoiceCreateSearch({})).toEqual({
      type: undefined,
      patient: undefined,
      from: undefined,
    });
  });
});

describe('validateInvoiceSearch (S:93–94)', () => {
  it('holds the referrer as text — checked where it is used', () => {
    expect(validateInvoiceSearch({ from: 'today' })).toEqual({ from: 'today' });
    expect(validateInvoiceSearch({ from: 42 })).toEqual({ from: '42' });
    expect(validateInvoiceSearch({ from: { to: 'x' } })).toEqual({ from: undefined });
  });
});
