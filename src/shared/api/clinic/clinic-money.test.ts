import { afterEach, describe, expect, it } from 'vitest';

import {
  balanceOf as billBalance,
  belowFloor,
  dayModeTotals,
  discountableSubtotal,
  discountForFinal,
  expectedDrawerCash,
  invoiceBalance,
  invoiceLineAmounts,
  invoicePaid,
  invoiceTotals,
  lineFinal,
  lineFloor,
  overallDiscountFromPercent,
  overallDiscountPercent,
} from '@/shared/api/clinic/clinic-money.ts';
import type { InvoiceItem, Payment } from '@/shared/api/clinic/clinic-schema.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem => ({
  offeringId: null,
  medicineId: null,
  name: 'Chemical peel',
  packSize: null,
  qty: 1,
  rate: 350_000,
  discountPct: 0,
  gstPct: 0,
  batchNo: null,
  ...overrides,
});

const payment = (overrides: Partial<Payment>): Payment =>
  ({
    invoiceId: 'invoice-a',
    direction: 'received',
    kind: 'receipt',
    amount: 0,
    deletedAt: null,
    ...overrides,
  }) as Payment;

describe('invoiceLineAmounts', () => {
  it('takes the discount off the base and charges GST on the rest', () => {
    expect(
      invoiceLineAmounts(item({ qty: 1, rate: 350_000, discountPct: 10, gstPct: 18 })),
    ).toEqual({ base: 350_000, discount: 35_000, gst: 56_700, net: 371_700 });
  });

  it('multiplies the rate by the quantity', () => {
    expect(invoiceLineAmounts(item({ qty: 8, rate: 12_000, gstPct: 12 }))).toEqual({
      base: 96_000,
      discount: 0,
      gst: 11_520,
      net: 107_520,
    });
  });
});

describe('invoiceTotals', () => {
  it('sums the lines and takes the overall discount off the bill', () => {
    expect(
      invoiceTotals({
        items: [
          item({ qty: 2, rate: 65_000, gstPct: 18 }),
          item({ rate: 300_000, discountPct: 5 }),
        ],
        overallDiscount: 5_000,
      }),
    ).toEqual({
      subtotal: 430_000,
      lineDiscount: 15_000,
      gst: 23_400,
      lineNet: 438_400,
      overallDiscount: 5_000,
      bill: 433_400,
    });
  });

  it('rounds the bill once, to the paisa', () => {
    const totals = invoiceTotals({
      items: [item({ rate: 333, gstPct: 18 }), item({ rate: 333, gstPct: 18 })],
      overallDiscount: 0,
    });
    expect(totals.gst).toBeCloseTo(119.88);
    expect(totals.bill).toBe(786);
  });

  it('never bills below zero', () => {
    expect(
      invoiceTotals({
        items: [item({ rate: 10_000, discountPct: 50 })],
        overallDiscount: 9_000,
      }).bill,
    ).toBe(0);
  });

  it('bills nothing for an invoice without lines', () => {
    expect(invoiceTotals({ items: [], overallDiscount: 0 }).bill).toBe(0);
  });
});

describe('invoicePaid', () => {
  it('counts receipts less refunds against the invoice only', () => {
    expect(
      invoicePaid('invoice-a', [
        payment({ amount: 60_000 }),
        payment({ amount: 40_000 }),
        payment({ direction: 'paid', kind: 'refund', amount: 10_000 }),
        payment({ invoiceId: 'invoice-b', amount: 99_000 }),
        payment({ invoiceId: null, direction: 'paid', kind: 'expense', amount: 5_000 }),
      ]),
    ).toBe(90_000);
  });

  it('ignores a deleted ledger entry', () => {
    expect(
      invoicePaid('invoice-a', [
        payment({ amount: 60_000, deletedAt: '2026-09-30T05:00:00.000Z' }),
      ]),
    ).toBe(0);
  });
});

describe('invoiceBalance', () => {
  const invoice = {
    id: 'invoice-a',
    items: [item({ rate: 100_000 })],
    overallDiscount: 0,
  };

  it('is unpaid with nothing received', () => {
    expect(invoiceBalance(invoice, [])).toEqual({
      bill: 100_000,
      paid: 0,
      due: 100_000,
      status: 'unpaid',
    });
  });

  it('is partly paid with something received', () => {
    expect(invoiceBalance(invoice, [payment({ amount: 40_000 })])).toMatchObject({
      due: 60_000,
      status: 'partial',
    });
  });

  it('is paid when nothing is due, and never owes below zero', () => {
    expect(invoiceBalance(invoice, [payment({ amount: 120_000 })])).toMatchObject({
      due: 0,
      status: 'paid',
    });
  });

  it('is paid when the bill is zero', () => {
    expect(invoiceBalance({ ...invoice, items: [item({ rate: 0 })] }, []).status).toBe(
      'paid',
    );
  });
});

describe('dayModeTotals / expectedDrawerCash (Q-G5, S:715)', () => {
  const entry = (overrides: Partial<Payment>) =>
    ({ direction: 'received', deletedAt: null, splits: [], ...overrides }) as Payment;

  it('counts each split row under its own mode, Credit apart, deleted entries not at all', () => {
    const totals = dayModeTotals([
      entry({
        splits: [
          { mode: 'cash', amount: 30_000 },
          { mode: 'upi', amount: 20_000 },
        ],
      }),
      entry({ direction: 'paid', splits: [{ mode: 'cash', amount: 26_000 }] }),
      entry({ splits: [{ mode: 'credit', amount: 50_000 }] }),
      entry({
        splits: [{ mode: 'cash', amount: 99_000 }],
        deletedAt: '2026-10-03T05:00:00Z',
      }),
    ]);
    expect(totals).toEqual({
      cash: { in: 30_000, out: 26_000 },
      upi: { in: 20_000, out: 0 },
      card: { in: 0, out: 0 },
      credit: { in: 50_000, out: 0 },
    });
    // The drawer: ₹2,000 opening + ₹300 in − ₹260 out.
    expect(expectedDrawerCash(200_000, totals)).toBe(204_000);
  });
});

describe('the fixture world', () => {
  afterEach(() => resetClinicFixtures());

  const balanceOf = (seq: number) => {
    const invoice = clinicFixtures.invoices.snapshot().find((row) => row.seq === seq);
    if (!invoice) throw new Error(`invoice #${seq}`);
    return invoiceBalance(invoice, clinicFixtures.payments.snapshot());
  };

  it('reads the seeded dues (PY_INV, H:3613–3622) — medicine at MRP, GST included', () => {
    // INV-785: Flubolt 400 × 8 at ₹120 and Clonix-B Lotion at ₹340, MRP with GST
    // included (KICKOFF §6.9) — the prototype's seed added 12% / 18% on top
    // (₹1,476.40); a standing deviation. ₹600 paid.
    expect(balanceOf(785)).toEqual({
      bill: 130_000,
      paid: 60_000,
      due: 70_000,
      status: 'partial',
    });
    expect(balanceOf(787)).toMatchObject({ bill: 480_000, status: 'unpaid' });
    expect(balanceOf(781)).toMatchObject({ bill: 765_000, due: 0, status: 'paid' });
  });
});

describe('the invoice drawer’s figures (KICKOFF §6.9)', () => {
  // ₹4,800 + ₹2,500 × 2, 10% off the second line, 18% GST on both.
  const lines = [
    item({ rate: 480_000, gstPct: 18 }),
    item({ qty: 2, rate: 250_000, discountPct: 10, gstPct: 18 }),
  ];

  it('takes the overall percent off the subtotal after line discounts, before tax (Q-G7)', () => {
    // ₹9,800 − ₹500 of line discount = ₹9,300.
    expect(discountableSubtotal(lines)).toBe(930_000);
    // 5% of ₹9,300 — not of the ₹10,974 after GST, as the prototype did (H:3632).
    expect(overallDiscountFromPercent(lines, 5)).toBe(46_500);
    const totals = invoiceTotals({ items: lines, overallDiscount: 46_500 });
    // ₹9,300 + ₹1,674 GST − ₹465.
    expect(totals.bill).toBe(1_050_900);
  });

  it('rounds the overall discount to the paisa and holds the percent to 0–100', () => {
    expect(overallDiscountFromPercent([item({ rate: 33_333 })], 10)).toBe(3_333);
    expect(overallDiscountFromPercent(lines, 140)).toBe(930_000);
    expect(overallDiscountFromPercent(lines, -5)).toBe(0);
  });

  it('reads a stored overall discount back as the drawer’s percent', () => {
    expect(overallDiscountPercent(lines, 46_500)).toBe(5);
    expect(overallDiscountPercent([item({ rate: 30_000 })], 1_000)).toBeCloseTo(3.33, 2);
    expect(overallDiscountPercent([], 1_000)).toBe(0);
  });

  it('back-solves the Disc % from a typed Final, which then holds to the paisa', () => {
    const line = item({ qty: 2, rate: 480_000, gstPct: 18 });
    expect(lineFinal(line)).toBe(1_132_800);
    const discountPct = discountForFinal(line, 1_000_000);
    expect(discountPct).toBeCloseTo(11.7232, 4);
    expect(lineFinal({ ...line, discountPct })).toBe(1_000_000);
  });

  it('holds a typed Final between nothing and the undiscounted line', () => {
    const line = item({ rate: 100_000, discountPct: 30 });
    expect(discountForFinal(line, 150_000)).toBe(0);
    expect(discountForFinal(line, -5)).toBe(100);
    expect(discountForFinal(item({ rate: 0 }), 5_000)).toBe(0);
  });

  it('floors a line at its floor per unit × the quantity, GST on top unless included (H:5059)', () => {
    const line = { qty: 2, gstPct: 18 };
    expect(lineFloor(line, 400_000)).toBe(944_000);
    expect(lineFloor(line, 400_000, true)).toBe(800_000);
    expect(lineFloor(line, 0)).toBeNull();
    expect(lineFloor(line, null)).toBeNull();
  });

  it('flags a Final below its floor, half a rupee of rounding allowed', () => {
    // LHR Full Face · B4G7 — ₹4,800, lowest price ₹4,000.
    const floor = lineFloor({ qty: 1, gstPct: 0 }, 400_000);
    // 16% off: ₹4,032. 17% off: ₹3,984.
    expect(belowFloor(item({ rate: 480_000, discountPct: 16 }), floor)).toBe(false);
    expect(belowFloor(item({ rate: 480_000, discountPct: 17 }), floor)).toBe(true);
    expect(
      belowFloor(
        item({
          rate: 480_000,
          discountPct: discountForFinal(item({ rate: 480_000 }), 399_960),
        }),
        floor,
      ),
    ).toBe(false);
    expect(belowFloor(item({ rate: 480_000, discountPct: 90 }), null)).toBe(false);
  });

  it('weighs a draft bill against what is paid: due, and Paid / Partly paid / Due (H:3633)', () => {
    expect(billBalance(32_400, 32_400)).toEqual({
      bill: 32_400,
      paid: 32_400,
      due: 0,
      status: 'paid',
    });
    expect(billBalance(32_400, 10_000)).toMatchObject({ due: 22_400, status: 'partial' });
    expect(billBalance(32_400, 0)).toMatchObject({ due: 32_400, status: 'unpaid' });
    expect(billBalance(0, 0).status).toBe('paid');
  });
});
