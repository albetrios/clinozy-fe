import { afterEach, describe, expect, it } from 'vitest';

import {
  invoiceBalance,
  invoiceLineAmounts,
  invoicePaid,
  invoiceTotals,
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
