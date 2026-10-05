import { describe, expect, it } from 'vitest';

import type { InvoiceDetail } from '@/shared/api/clinic/invoices-contracts.ts';

import {
  blankLine,
  copiedInvoiceForm,
  draftFigures,
  emptyInvoiceForm,
  invoiceFormOf,
  type InvoiceFormValues,
  invoiceInputOf,
  namedLines,
  paidNowSplits,
  paidNowTotal,
  percentOf,
} from './invoice-form.ts';

const BRANCH = '8adb0054-f0cf-4a71-8366-a1a2074930c7';
const PATIENT = '3eee5550-eff8-4c65-9a38-cdaea2136773';
const VESU = '5c1f0b7e-2d4a-4e8b-9a6c-7d3e2f1a0b9c';

const corn = { ...blankLine(), offeringId: 'corn', name: 'Corn Removal', rate: 100_000 };

const values = (overrides: Partial<InvoiceFormValues> = {}): InvoiceFormValues => ({
  ...emptyInvoiceForm('2026-10-03', { branchId: BRANCH }),
  party: { kind: 'patient', id: PATIENT, name: 'Dharti Galani', phone: null },
  items: [{ ...corn, qty: 2 }, blankLine()],
  ...overrides,
});

describe('the Invoice drawer’s form (KICKOFF §6.9)', () => {
  it('starts a new invoice with one blank row and one empty UPI row, today', () => {
    expect(emptyInvoiceForm('2026-10-03')).toMatchObject({
      type: 'clinic',
      items: [blankLine()],
      paidNow: [{ mode: 'upi', amount: 0 }],
      overallDiscountPct: '',
      date: '2026-10-03',
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

  it('works out the draft: the named lines, the overall percent in paise, the balance', () => {
    const figures = draftFigures(
      values({ overallDiscountPct: '10', paidNow: [{ mode: 'cash', amount: 50_000 }] }),
      20_000,
    );
    expect(namedLines(values().items)).toHaveLength(1);
    expect(figures.overallDiscount).toBe(20_000);
    expect(figures.totals.bill).toBe(180_000);
    expect(figures.balance).toEqual({
      bill: 180_000,
      paid: 70_000,
      due: 110_000,
      status: 'partial',
    });
  });

  it('writes the contract’s input: the named lines, the party, the discount in paise', () => {
    const input = invoiceInputOf(
      values({ overallDiscountPct: '5', remark: '  Second sitting  ' }),
      'fallback',
    );
    expect(input).toMatchObject({
      type: 'clinic',
      branchId: BRANCH,
      patientId: PATIENT,
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
    const contact = invoiceInputOf(
      values({
        type: 'medical',
        branchId: null,
        party: { kind: 'contact', id: 'c-1', name: 'Viral Sheth', phone: null },
      }),
      BRANCH,
    );
    expect(contact).toMatchObject({
      branchId: BRANCH,
      patientId: null,
      medicalContactId: 'c-1',
      leadId: null,
    });
    const lead = invoiceInputOf(
      values({ party: { kind: 'lead', id: 'l-1', name: 'Kabir', phone: null } }),
      BRANCH,
    );
    expect(lead).toMatchObject({ leadId: 'l-1', medicalContactId: null });
  });

  it('opens a saved invoice as its form — the overall discount back as a percent, nothing paid now', () => {
    const detail = {
      invoice: {
        type: 'clinic',
        branchId: BRANCH,
        teamIds: ['t-1'],
        items: [{ ...corn, qty: 2, batchNo: null }],
        overallDiscount: 20_000,
        remark: null,
        date: '2026-09-24',
        prescriptionId: null,
      },
      party: {
        kind: 'patient',
        id: PATIENT,
        seq: 3508,
        name: 'Dharti Galani',
        firstName: 'Dharti',
        lastName: 'Galani',
        phone: '+919825044120',
      },
    } as unknown as InvoiceDetail;
    expect(invoiceFormOf(detail)).toMatchObject({
      overallDiscountPct: '10',
      remark: '',
      paidNow: [{ mode: 'upi', amount: 0 }],
      teamIds: ['t-1'],
      party: { kind: 'patient', name: 'Dharti Galani', phone: '+919825044120' },
    });
  });

  it('copies what a saved invoice bills — lines, discounts, party, team, remark — today, nothing paid (Copy invoice)', () => {
    const line = { ...corn, qty: 2, discountPct: 5, gstPct: 18, batchNo: 'B-42' };
    const detail = {
      invoice: {
        type: 'medical',
        branchId: BRANCH,
        teamIds: ['t-1'],
        items: [line],
        // 10% of the ₹1,900 left after the line's 5%.
        overallDiscount: 19_000,
        remark: 'From today’s visit',
        date: '2026-09-24',
        prescriptionId: 'rx-1',
      },
      party: {
        kind: 'patient',
        id: PATIENT,
        seq: 3508,
        name: 'Dharti Galani',
        firstName: 'Dharti',
        lastName: 'Galani',
        phone: '+919825044120',
      },
    } as unknown as InvoiceDetail;
    // Copied at another branch than the one it was raised at.
    const copy = copiedInvoiceForm(detail, '2026-10-03', VESU);
    expect(copy).toEqual({
      type: 'medical',
      // Filed where it is raised, like any new invoice — where a sale draws its stock.
      branchId: VESU,
      party: {
        kind: 'patient',
        id: PATIENT,
        name: 'Dharti Galani',
        phone: '+919825044120',
      },
      teamIds: ['t-1'],
      // The line as billed — its quantity, price, discount and GST — without the
      // batch its sale drew.
      items: [{ ...line, batchNo: null }],
      overallDiscountPct: '10',
      remark: 'From today’s visit',
      // Today, nothing paid, and not the prescription the original dispensed.
      date: '2026-10-03',
      paidNow: [{ mode: 'upi', amount: 0 }],
      prescriptionId: null,
    });
    // The saved invoice is left as it was.
    expect(detail.invoice.items[0]?.batchNo).toBe('B-42');
  });
});
