import { describe, expect, it } from 'vitest';

import {
  invoiceDetail,
  TEST_DOCTOR_ID,
  TEST_PEEL_ID,
} from '@/tests/utils/invoice-doubles.ts';
import {
  invoiceRecord,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  blankLine,
  copiedInvoiceForm,
  emptyInvoiceForm,
  invoiceFormOf,
  type InvoiceFormValues,
  invoiceInputOf,
  namedLines,
  overallDiscountPaise,
  paidNowSplits,
  paidNowTotal,
  percentOf,
  sentLines,
} from './invoice-form.ts';
import { draftFigures, saleInputOf } from './sale-form.ts';

const VESU = 'brn_thsaog1i8bv6m9rd9ucoy';

const peel = { ...blankLine(), offeringId: TEST_PEEL_ID, name: 'Research Peel' };

const values = (overrides: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  ...emptyInvoiceForm('2026-10-10', { branchId: TEST_MONEY_BRANCH_ID }),
  party: {
    kind: 'patient',
    id: TEST_MONEY_PATIENT_ID,
    contactId: TEST_MONEY_CONTACT_ID,
    name: 'Kavya Mehta',
    phone: null,
  },
  items: [{ ...peel, qty: 2, discountPct: 12.345 }, blankLine()],
  ...overrides,
});

describe('the Invoice drawer’s form (KICKOFF §6.9)', () => {
  it('starts a new invoice with one blank row and one empty UPI row, today', () => {
    expect(emptyInvoiceForm('2026-10-10')).toMatchObject({
      type: 'clinic',
      items: [blankLine()],
      paidNow: [{ mode: 'upi', amount: 0 }],
      overallDiscountPct: '',
      overallDiscount: '',
      date: '2026-10-10',
      party: null,
    });
  });

  it('reads the percent field’s text — nothing or a stray point is 0, past 100 is 100', () => {
    expect(percentOf('')).toBe(0);
    expect(percentOf('.')).toBe(0);
    expect(percentOf('12.5')).toBe(12.5);
    expect(percentOf('140')).toBe(100);
  });

  it('records "Paid now" as one split per mode, the empty rows left out', () => {
    const rows = [
      { mode: 'cash' as const, amount: 10_000 },
      { mode: 'upi' as const, amount: 0 },
      { mode: 'cash' as const, amount: 5_000 },
    ];
    expect(paidNowSplits(rows)).toEqual([{ mode: 'cash', amount: 15_000 }]);
    expect(paidNowTotal(rows)).toBe(15_000);
  });

  it('sends the rows with an offering, each with its place in the form', () => {
    const items = [blankLine(), { ...peel, qty: 1 }, { ...blankLine(), name: 'Gone' }];
    expect(sentLines(items).map(({ row }) => row)).toEqual([1]);
    expect(namedLines(items)).toHaveLength(2);
  });

  it('writes an invoice’s input — the contact, the lines by offering, the money in rupees — and nothing of the price', () => {
    const input = invoiceInputOf(
      values({
        overallDiscount: '150.5',
        remark: 'Second sitting',
        teamIds: [TEST_DOCTOR_ID],
        paidNow: [
          { mode: 'cash', amount: 50_000 },
          { mode: 'upi', amount: 12_345 },
        ],
      }),
      'brn_fallback',
    );
    expect(input).toEqual({
      type: 'clinic',
      branchId: TEST_MONEY_BRANCH_ID,
      contactId: TEST_MONEY_CONTACT_ID,
      teamIds: [TEST_DOCTOR_ID],
      items: [
        {
          id: null,
          offeringId: TEST_PEEL_ID,
          qty: 2,
          discountPct: 12.345,
          suggestionId: null,
          treatmentIds: [],
        },
      ],
      overallDiscount: 150.5,
      date: '2026-10-10',
      remark: 'Second sitting',
      prescriptionId: null,
      paidNow: [
        { mode: 'cash', amount: 500 },
        { mode: 'upi', amount: 123.45 },
      ],
    });
    expect(overallDiscountPaise({ overallDiscount: '' })).toBe(0);
  });

  it('opens a saved invoice as its form — the lines by id, the overall discount in rupees, nothing paid now', () => {
    const detail = invoiceDetail(
      invoiceRecord({ overallDiscount: 50, teamIds: [TEST_DOCTOR_ID], remark: null }),
    );
    const form = invoiceFormOf(detail);
    expect(form).toMatchObject({
      type: 'consultation',
      branchId: TEST_MONEY_BRANCH_ID,
      overallDiscount: '50',
      remark: '',
      paidNow: [{ mode: 'upi', amount: 0 }],
      teamIds: [TEST_DOCTOR_ID],
      party: {
        kind: 'patient',
        id: TEST_MONEY_PATIENT_ID,
        contactId: TEST_MONEY_CONTACT_ID,
        name: 'Kavya Mehta',
      },
    });
    expect(form.items).toEqual([
      expect.objectContaining({
        id: 'iitm_7ocmisga5mzisg1w1uok1',
        offeringId: 'off_3f4nzxf53tfyf9k6hlna1',
        name: 'Consultation',
        qty: 1,
        discountPct: 0,
      }),
    ]);
  });

  it('copies what a saved invoice bills — lines, discounts, party, team, remark — today, nothing paid (Copy invoice)', () => {
    const detail = invoiceDetail(
      invoiceRecord({ teamIds: [TEST_DOCTOR_ID], remark: 'From today’s visit' }),
    );
    // Copied at another branch than the one it was raised at.
    const copy = copiedInvoiceForm(detail, '2026-10-11', VESU);
    expect(copy).toMatchObject({
      type: 'consultation',
      // Filed where it is raised, like any new invoice.
      branchId: VESU,
      teamIds: [TEST_DOCTOR_ID],
      remark: 'From today’s visit',
      date: '2026-10-11',
      paidNow: [{ mode: 'upi', amount: 0 }],
      prescriptionId: null,
    });
    // A new line each — no saved id, no plan row or treatment of the original's.
    expect(copy.items).toEqual([
      expect.objectContaining({
        id: null,
        offeringId: 'off_3f4nzxf53tfyf9k6hlna1',
        suggestionId: null,
        treatmentIds: [],
      }),
    ]);
  });

  it('copies a Medical sale’s invoice as a fresh sale — Medical sells from its own stock', () => {
    const detail = invoiceDetail(invoiceRecord({ type: 'medical' }));
    expect(copiedInvoiceForm(detail, '2026-10-11', VESU)).toMatchObject({
      type: 'medical',
      branchId: VESU,
      items: [blankLine()],
      party: null,
    });
  });
});

describe('a Medical sale’s form (the fixture world, D153)', () => {
  const corn = {
    ...blankLine(),
    offeringId: 'corn',
    name: 'Corn Removal',
    rate: 100_000,
  };
  const sale = (overrides: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
    ...values({ items: [{ ...corn, qty: 2 }, blankLine()] }),
    ...overrides,
  });

  it('works out the draft: the named lines, the overall percent in paise, the balance', () => {
    const figures = draftFigures(
      sale({ overallDiscountPct: '10', paidNow: [{ mode: 'cash', amount: 50_000 }] }),
    );
    expect(figures.overallDiscount).toBe(20_000);
    expect(figures.totals.bill).toBe(180_000);
    expect(figures.balance).toEqual({
      bill: 180_000,
      paid: 50_000,
      due: 130_000,
      status: 'partial',
    });
  });

  it('writes the fixture sale’s input: the named lines, the party, the discount in paise', () => {
    const input = saleInputOf(
      sale({ overallDiscountPct: '5', remark: '  Second sitting  ' }),
      'fallback',
    );
    expect(input).toMatchObject({
      branchId: TEST_MONEY_BRANCH_ID,
      patientId: TEST_MONEY_PATIENT_ID,
      medicalContactId: null,
      leadId: null,
      overallDiscount: 10_000,
      remark: 'Second sitting',
      paidNow: [],
    });
    expect(input.items).toEqual([
      {
        offeringId: 'corn',
        medicineId: null,
        name: 'Corn Removal',
        packSize: null,
        qty: 2,
        rate: 100_000,
        discountPct: 0,
        gstPct: 0,
      },
    ]);
  });

  it('sends a Medical customer as a contact or a lead, and the fallback branch when none is set', () => {
    const contact = saleInputOf(
      sale({
        type: 'medical',
        branchId: null,
        party: {
          kind: 'contact',
          id: 'c-1',
          contactId: null,
          name: 'Viral Sheth',
          phone: null,
        },
      }),
      TEST_MONEY_BRANCH_ID,
    );
    expect(contact).toMatchObject({
      branchId: TEST_MONEY_BRANCH_ID,
      patientId: null,
      medicalContactId: 'c-1',
      leadId: null,
    });
    const lead = saleInputOf(
      sale({
        party: { kind: 'lead', id: 'l-1', contactId: null, name: 'Kabir', phone: null },
      }),
      TEST_MONEY_BRANCH_ID,
    );
    expect(lead).toMatchObject({ leadId: 'l-1', medicalContactId: null });
  });
});
