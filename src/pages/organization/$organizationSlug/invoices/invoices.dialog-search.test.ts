import { describe, expect, it } from 'vitest';

import { INVOICE_TYPE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  INVOICE_TYPE_PARAMS,
  validateInvoiceCreateSearch,
} from './invoices.dialog-search.ts';

const PATIENT = 'pat_9e6j52vjb8uhvz44ebe94';
const INVOICE = 'invc_4ea44s81zsxncy705mp01';
const VISIT = 'appt_priya0000000000000000';
const OLD_UUID = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

describe('the contract’s values, declared for the link reader', () => {
  it('name every invoice type, in the switch’s order', () => {
    expect([...INVOICE_TYPE_PARAMS].sort()).toEqual([...INVOICE_TYPE_VALUES].sort());
  });
});

describe('validateInvoiceCreateSearch (S:92)', () => {
  it('keeps the type, the patient, the invoice copied, the visit billed and the room to go back to', () => {
    expect(
      validateInvoiceCreateSearch({
        type: 'medical',
        patient: PATIENT,
        copyOf: INVOICE,
        appointment: VISIT,
        from: ' patients/x/invoices ',
      }),
    ).toEqual({
      type: 'medical',
      patient: PATIENT,
      copyOf: INVOICE,
      appointment: VISIT,
      from: 'patients/x/invoices',
    });
  });

  it('takes public ids only — a fixture-days uuid is dropped', () => {
    expect(
      validateInvoiceCreateSearch({
        patient: OLD_UUID,
        copyOf: OLD_UUID,
        appointment: OLD_UUID,
      }),
    ).toEqual({
      type: undefined,
      patient: undefined,
      copyOf: undefined,
      appointment: undefined,
      from: undefined,
    });
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
