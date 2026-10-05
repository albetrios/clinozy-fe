import { describe, expect, it } from 'vitest';

import type { SaleRow } from '../../../shared/medical-contracts.ts';
import {
  everythingBack,
  lineRefund,
  linesBack,
  returnAmount,
  saleReturnFormOf,
  saleReturnInputOf,
} from './sale-return-form.ts';

const GLYCOLAC = '6d0a4f8e-7c1b-4e2a-9b3c-1d2e3f4a5b6c';
const BEYOLAIC = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/** A sale of 2 × Glycolac (₹162 each) and 1 × Beyolaic (₹239), one Glycolac back already. */
const SALE: Pick<SaleRow, 'lines' | 'returns'> = {
  lines: [
    {
      medicineId: BEYOLAIC,
      name: 'Beyolaic Cream',
      qty: 1,
      batchNo: 'ADE25510',
      amount: 23_900,
    },
    {
      medicineId: GLYCOLAC,
      name: 'Glycolac Cream',
      qty: 2,
      batchNo: '026-312',
      amount: 32_400,
    },
    { medicineId: null, name: 'Consultation', qty: 1, batchNo: null, amount: 50_000 },
  ],
  returns: [
    {
      items: [{ medicineId: GLYCOLAC, batchNo: '026-312', qty: 1 }],
      amount: 16_200,
      reason: 'unused',
      at: '2026-10-03T04:30:00.000Z',
    },
  ],
};

describe('Return from patient’s form (medical.md:283–295)', () => {
  it('opens on each line still out — nothing back yet — Unused, refunded in Cash', () => {
    const form = saleReturnFormOf(SALE);
    expect(form.reason).toBe('unused');
    expect(form.mode).toBe('cash');
    expect(form.lines.map((line) => [line.name, line.sold, line.unit, line.qty])).toEqual(
      [
        ['Beyolaic Cream', 1, 23_900, 0],
        ['Glycolac Cream', 1, 16_200, 0],
      ],
    );
  });

  it('drops a line already all back', () => {
    const form = saleReturnFormOf({
      ...SALE,
      returns: [
        {
          items: [{ medicineId: GLYCOLAC, batchNo: '026-312', qty: 2 }],
          amount: 32_400,
          reason: 'unused',
          at: '2026-10-03T04:30:00.000Z',
        },
      ],
    });
    expect(form.lines.map((line) => line.name)).toEqual(['Beyolaic Cream']);
  });

  it('prices what comes back, and "Return everything" fills every line', () => {
    const form = saleReturnFormOf(SALE);
    expect(returnAmount(form.lines)).toBe(0);
    expect(linesBack(form.lines)).toHaveLength(0);
    const all = everythingBack(form.lines);
    expect(all.map((line) => line.qty)).toEqual([1, 1]);
    expect(lineRefund({ unit: 16_200, qty: 1 })).toBe(16_200);
    expect(returnAmount(all)).toBe(23_900 + 16_200);
  });

  it('sends only the lines coming back', () => {
    const [beyolaic, glycolac] = saleReturnFormOf(SALE).lines;
    if (!(beyolaic && glycolac)) throw new Error('expected two lines');
    expect(
      saleReturnInputOf({
        lines: [beyolaic, { ...glycolac, qty: 1 }],
        reason: 'damaged',
        mode: 'upi',
      }),
    ).toEqual({
      lines: [{ medicineId: GLYCOLAC, batchNo: '026-312', qty: 1 }],
      reason: 'damaged',
      mode: 'upi',
    });
  });
});
