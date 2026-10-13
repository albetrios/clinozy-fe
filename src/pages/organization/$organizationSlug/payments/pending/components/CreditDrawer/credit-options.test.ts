import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';

import { PAYMENTS_NS } from '../../../payments.constants.ts';
import { partyByName } from './credit-form.ts';
import {
  creditPartyOption,
  invoiceOptions,
  NO_INVOICE,
  pickedPartyOption,
} from './credit-options.ts';

const t = i18n.getFixedT('en', PAYMENTS_NS);
const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

describe('the Who picker’s rows (payments.md:157)', () => {
  it('lists a patient on its avatar with the "P" badge, under Patients', () => {
    expect(
      creditPartyOption(
        {
          kind: 'patient',
          contactId: 'con_kiran',
          patientId: 'pat_kiran',
          seq: 3441,
          name: 'Kiran Desai',
          phone: '+919825011111',
        },
        t,
      ),
    ).toMatchObject({
      key: 'patient:pat_kiran',
      label: 'Kiran Desai',
      // The id isolated in the translated line (a right-to-left page keeps it whole).
      sub: `Patient · ${fsi('#3441')}`,
      group: 'Patients',
      leading: { kind: 'avatar', initials: 'KD', patient: true },
    });
  });

  it('lists contacts with their mobile, suppliers by what they supply', () => {
    expect(
      creditPartyOption(
        {
          kind: 'contact',
          contactId: 'con_viral',
          name: 'Viral Sheth',
          phone: '+919825077120',
        },
        t,
      ),
    ).toMatchObject({
      key: 'contact:con_viral',
      sub: `Contact · ${fsi('+91 98250 77120')}`,
      group: 'Contacts',
      leading: { kind: 'avatar', initials: 'VS' },
    });
    expect(
      creditPartyOption(
        { kind: 'contact', contactId: 'con_asha', name: 'Asha', phone: '' },
        t,
      ).sub,
    ).toBe('Contact');
    expect(
      creditPartyOption({ kind: 'vendor', id: 'v1', name: 'Medline Surgicals' }, t),
    ).toMatchObject({ sub: 'Clinic vendor', group: 'Suppliers & vendors' });
    expect(
      creditPartyOption({ kind: 'supplier', id: 's1', name: 'NH Pharma' }, t).sub,
    ).toBe('Medical supplier');
  });

  it('shows the picked party in the trigger before its page loads', () => {
    expect(
      pickedPartyOption({
        key: 'patient:pat_kiran',
        name: 'Kiran Desai',
        contactId: 'con_kiran',
        patientId: 'pat_kiran',
      }),
    ).toMatchObject({
      key: 'patient:pat_kiran',
      label: 'Kiran Desai',
      leading: { kind: 'avatar', initials: 'KD', patient: true },
    });
    const supplier = pickedPartyOption(partyByName('Medline Surgicals'));
    expect(supplier).toMatchObject({
      key: 'name:medline-surgicals',
      label: 'Medline Surgicals',
      tone: 'stone',
    });
    expect(supplier.leading).toBeUndefined();
  });
});

describe('the For invoice rows (payments.md:160)', () => {
  it('offers "No invoice", then each invoice with its bill and due — or "paid"', () => {
    const options = invoiceOptions({
      invoices: [
        invoiceRecord({
          id: 'i772',
          seq: 772,
          date: '2026-09-03',
          total: 1_000,
          paid: 400,
          due: 600,
        }),
        invoiceRecord({
          id: 'i779',
          seq: 779,
          date: '2026-08-26',
          total: 1_534,
          paid: 1_534,
          due: 0,
        }),
      ],
      t,
      formatRupees: rupees,
      formatDay: (day) => `day ${day}`,
    });
    expect(options.map((option) => option.key)).toEqual([NO_INVOICE, 'i772', 'i779']);
    expect(options[0]?.label).toBe('No invoice');
    expect(options[1]).toMatchObject({
      label: 'Invoice #772',
      sub: '₹1,000 · ₹600 due',
      meta: 'day 2026-09-03',
    });
    expect(options[2]?.sub).toBe('₹1,534 · paid');
  });
});
