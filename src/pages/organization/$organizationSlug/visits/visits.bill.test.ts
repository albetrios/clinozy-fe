import { describe, expect, it } from 'vitest';

import type { VisitBillLine } from '@/shared/api/clinic/visits-contracts.ts';

import { amountFromText, amountText, visitBill } from './visits.bill.ts';

const line = (fields: Partial<VisitBillLine>): VisitBillLine => ({
  name: 'Line',
  offeringId: null,
  qty: 1,
  rate: 0,
  discountPct: 0,
  gstPct: 0,
  fromPack: false,
  ...fields,
});

describe('visitBill (Checkout › 1 · Bill, `today.md:263`)', () => {
  it('reads the design’s bill: consult GST exempt, the peel 10% off with 18% GST, the pack session free', () => {
    const bill = visitBill({
      billLines: [
        line({ name: 'Consultation', rate: 80_000 }),
        line({ name: 'Chemical peel', rate: 350_000, discountPct: 10, gstPct: 18 }),
        line({ name: 'Laser session 4 of 6', fromPack: true }),
      ],
      billDue: 451_700,
      previousDue: { amount: 120_000, invoice: null },
    });
    expect(bill.rows).toEqual([
      { name: 'Consultation', amount: 80_000, note: { kind: 'gstExempt' } },
      {
        name: 'Chemical peel',
        amount: 350_000,
        note: { kind: 'discount', pct: 10, final: 315_000 },
      },
      { name: 'Laser session 4 of 6', amount: 0, note: { kind: 'fromPack' } },
    ]);
    expect(bill.afterDiscount).toBe(395_000);
    expect(bill.discount).toBe(35_000);
    expect(bill.gst).toEqual([{ rate: 18, base: 315_000, amount: 56_700 }]);
    expect(bill.previousDue).toBe(120_000);
    expect(bill.toPay).toBe(571_700);
  });

  it('notes nothing on a full-price taxed line, and has no GST rows without tax', () => {
    const bill = visitBill({
      billLines: [line({ rate: 10_000, gstPct: 5 }), line({ rate: 5_000 })],
      billDue: 15_500,
      previousDue: { amount: 0, invoice: null },
    });
    expect(bill.rows[0]?.note).toBeNull();
    expect(bill.gst).toEqual([{ rate: 5, base: 10_000, amount: 500 }]);
    expect(bill.toPay).toBe(15_500);
  });
});

describe('the amount field', () => {
  it('reads digits only, at most nine of them, as paise', () => {
    expect(amountFromText('3,717')).toBe(371_700);
    expect(amountFromText('')).toBe(0);
    expect(amountFromText('1234567890')).toBe(12_345_678_900);
  });

  it('writes what is owed in whole rupees, rounding paise up; nothing at zero', () => {
    expect(amountText(371_700)).toBe('3717');
    expect(amountText(371_650)).toBe('3717');
    expect(amountText(0)).toBe('');
  });
});
