import { describe, expect, it } from 'vitest';

import { paidSaleRow, TEST_SALE_INVOICE_ITEM_ID } from '@/tests/utils/medical-doubles.ts';

import type { SaleLine } from '../../../shared/medical-contracts.ts';
import {
  everythingBack,
  lineRefund,
  linesBack,
  returnAmount,
  saleReturnFormOf,
  saleReturnInputOf,
} from './sale-return-form.ts';

const BEYOLAIC_LINE = 'iitm_beyolaic000000000000';
const GLYCOLAC_LINE = TEST_SALE_INVOICE_ITEM_ID;

/** A sold line as the API answers it. */
const line = (patch: Partial<SaleLine>): SaleLine => ({
  invoiceItemId: GLYCOLAC_LINE,
  medicineId: 'med_glycolac0000000000000',
  name: 'Glycolac Cream',
  qty: 2,
  batchNo: '026-312',
  expiry: '11/26',
  rate: 162,
  discountPct: 0,
  amount: 324,
  returnedQty: 0,
  ...patch,
});

/** 1 × Beyolaic (₹239) and 2 × Glycolac (₹162 each), one Glycolac back already. */
const SALE = paidSaleRow({
  lines: [
    line({
      invoiceItemId: BEYOLAIC_LINE,
      name: 'Beyolaic Cream',
      qty: 1,
      batchNo: 'ADE25510',
      amount: 239,
    }),
    line({ returnedQty: 1 }),
  ],
});

describe('Return from patient’s form (medical.md:283–295)', () => {
  it('opens on each line still out — the server’s count back taken off — Unused, in Cash', () => {
    const form = saleReturnFormOf(SALE);
    expect(form.reason).toBe('unused');
    expect(form.mode).toBe('cash');
    expect(
      form.lines.map((entry) => [entry.name, entry.sold, entry.unit, entry.qty]),
    ).toEqual([
      ['Beyolaic Cream', 1, 23_900, 0],
      ['Glycolac Cream', 1, 16_200, 0],
    ]);
  });

  it('drops a line already all back', () => {
    const form = saleReturnFormOf({
      lines: [line({ returnedQty: 2 }), line({ invoiceItemId: BEYOLAIC_LINE, qty: 1 })],
    });
    expect(form.lines.map((entry) => entry.invoiceItemId)).toEqual([BEYOLAIC_LINE]);
  });

  it('prices what comes back in paise, and "Return everything" fills every line', () => {
    const form = saleReturnFormOf(SALE);
    expect(returnAmount(form.lines)).toBe(0);
    expect(linesBack(form.lines)).toHaveLength(0);
    const all = everythingBack(form.lines);
    expect(all.map((entry) => entry.qty)).toEqual([1, 1]);
    expect(lineRefund({ unit: 16_200, qty: 1 })).toBe(16_200);
    expect(returnAmount(all)).toBe(23_900 + 16_200);
  });

  it('sends only the lines coming back, by their invoice line — store credit too (MD33)', () => {
    const [beyolaic, glycolac] = saleReturnFormOf(SALE).lines;
    if (!(beyolaic && glycolac)) throw new Error('expected two lines');
    expect(
      saleReturnInputOf({
        lines: [beyolaic, { ...glycolac, qty: 1 }],
        reason: 'damaged',
        mode: 'credit',
      }),
    ).toEqual({
      lines: [{ invoiceItemId: GLYCOLAC_LINE, qty: 1 }],
      reason: 'damaged',
      mode: 'credit',
      note: null,
    });
  });
});
