import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import { PAYMENTS_NS } from '../../../payments.constants.ts';
import { partyByName } from './credit-form.ts';
import {
  creditPartyOption,
  invoiceOptions,
  NO_INVOICE,
  pickedPartyOption,
} from './credit-options.ts';

const t = i18n.getFixedT('en', PAYMENTS_NS);
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

describe('the Who picker’s rows (payments.md:157)', () => {
  it('lists a patient on its avatar with the "P" badge, under Patients', () => {
    expect(
      creditPartyOption(
        { kind: 'patient', id: 'p1', seq: 3441, name: 'Kiran Desai', phone: null },
        t,
      ),
    ).toMatchObject({
      key: 'patient:p1',
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
        { kind: 'contact', id: 'c1', name: 'Viral Sheth', phone: '+919825077120' },
        t,
      ),
    ).toMatchObject({
      key: 'name:viral-sheth',
      sub: `Contact · ${fsi('+91 98250 77120')}`,
      group: 'Contacts',
      leading: { kind: 'avatar', initials: 'VS' },
    });
    expect(
      creditPartyOption({ kind: 'contact', id: 'c2', name: 'Asha', phone: null }, t).sub,
    ).toBe('Contact');
    expect(
      creditPartyOption({ kind: 'vendor', id: 'v1', name: 'Medline Surgicals' }, t),
    ).toMatchObject({ sub: 'Clinic vendor', group: 'Suppliers & vendors' });
    expect(
      creditPartyOption({ kind: 'supplier', id: 's1', name: 'NH Pharma' }, t).sub,
    ).toBe('Medical supplier');
  });

  it('shows the picked party in the trigger before its page loads', () => {
    expect(pickedPartyOption(partyByName('Medline Surgicals'))).toMatchObject({
      key: 'name:medline-surgicals',
      label: 'Medline Surgicals',
      leading: { kind: 'avatar', initials: 'MS', patient: false },
    });
  });
});

describe('the For invoice rows (payments.md:160)', () => {
  it('offers "No invoice", then each invoice with its bill and due — or "paid"', () => {
    const options = invoiceOptions(
      [
        {
          id: 'i772',
          seq: 772,
          type: 'clinic',
          date: '2026-09-03',
          bill: 100_000,
          paid: 40_000,
          due: 60_000,
        },
        {
          id: 'i779',
          seq: 779,
          type: 'medical',
          date: '2026-08-26',
          bill: 153_400,
          paid: 153_400,
          due: 0,
        },
      ],
      t,
      rupees,
      (day) => `day ${day}`,
    );
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
