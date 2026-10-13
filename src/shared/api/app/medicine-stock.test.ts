import { describe, expect, it } from 'vitest';

import type { MedicineBatch } from './app-schema.ts';
import {
  batchesByExpiry,
  cheapestRate,
  drawerMarginTone,
  expiryDaysLeft,
  expiryMonthEnd,
  expiryTone,
  fefoTakes,
  listMarginTone,
  marginPercent,
  medicineStock,
  medicineStockHealth,
  medicineStockLevel,
  mrpSplit,
  nearestExpiry,
  reorderQuantity,
  stockFillPercent,
  withTakes,
} from './medicine-stock.ts';

const batch = (batchNo: string, expiry: string, qty: number): MedicineBatch => ({
  batchNo,
  expiry,
  qty,
  purchaseRate: 10_000,
});

const TODAY = '2026-10-04';

describe('stock levels', () => {
  it('sums the batches and reads Out, Low (at or below reorder) and OK', () => {
    expect(medicineStock([batch('A', '03/29', 8), batch('B', '01/28', 2)])).toBe(10);
    expect(medicineStockLevel(0, 2)).toBe('out');
    expect(medicineStockLevel(2, 2)).toBe('low');
    expect(medicineStockLevel(3, 2)).toBe('ok');
  });

  it('fills the bar to stock ÷ fill-up level, capped', () => {
    expect(stockFillPercent(8, 10)).toBe(80);
    expect(stockFillPercent(14, 10)).toBe(100);
    expect(stockFillPercent(0, 0)).toBe(0);
  });

  it('reads the drawer states and the reorder quantity', () => {
    expect(medicineStockHealth(0, 2, 10)).toBe('out');
    expect(medicineStockHealth(2, 2, 10)).toBe('reorder');
    expect(medicineStockHealth(12, 2, 10)).toBe('overstocked');
    expect(medicineStockHealth(8, 2, 10)).toBe('healthy');
    expect(reorderQuantity(2, 10)).toBe(8);
    expect(reorderQuantity(12, 10)).toBe(1);
  });
});

describe('expiry (counted to the end of the month, H:3720)', () => {
  it('finds the last day of an expiry month', () => {
    expect(expiryMonthEnd('02/28')).toBe('2028-02-29');
    expect(expiryMonthEnd('11/26')).toBe('2026-11-30');
    expect(expiryMonthEnd('13/26')).toBeNull();
  });

  it('counts days to that end and tones them: ≤ 30 blush, ≤ 90 butter, else sage', () => {
    expect(expiryDaysLeft('10/26', TODAY)).toBe(27);
    expect(expiryDaysLeft('11/26', TODAY)).toBe(57);
    expect(expiryTone(27)).toBe('blush');
    expect(expiryTone(57)).toBe('butter');
    expect(expiryTone(400)).toBe('sage');
    expect(expiryTone(null)).toBe('stone');
  });

  it('orders the batches in stock nearest expiry first, empty ones left out', () => {
    const batches = [
      batch('LATE', '05/28', 3),
      batch('EMPTY', '10/26', 0),
      batch('SOON', '11/26', 2),
    ];
    expect(batchesByExpiry(batches, TODAY).map((entry) => entry.batch.batchNo)).toEqual([
      'SOON',
      'LATE',
    ]);
    expect(nearestExpiry(batches, TODAY)?.batch.batchNo).toBe('SOON');
    expect(nearestExpiry([batch('EMPTY', '10/26', 0)], TODAY)).toBeNull();
  });
});

describe('FEFO — first expiry, first out', () => {
  const batches = [batch('LATE', '05/28', 5), batch('SOON', '11/26', 2)];

  it('draws from the batch that expires first, then the next', () => {
    expect(fefoTakes(batches, 3, TODAY)).toEqual({
      takes: [
        { batchNo: 'SOON', qty: 2 },
        { batchNo: 'LATE', qty: 1 },
      ],
      short: 0,
    });
    expect(withTakes(batches, fefoTakes(batches, 3, TODAY).takes)).toEqual([
      batch('LATE', '05/28', 4),
      batch('SOON', '11/26', 0),
    ]);
  });

  it('reports what the stock cannot cover', () => {
    expect(fefoTakes(batches, 9, TODAY).short).toBe(2);
  });
});

describe('margin', () => {
  it('reads the margin on the MRP at the cheapest supplier rate', () => {
    const best = cheapestRate([
      { supplierId: 'a', rate: 45_200, free: 1, leadDays: 3 },
      { supplierId: 'b', rate: 44_000, free: 0, leadDays: 2 },
      { supplierId: 'c', rate: 0, free: 0, leadDays: 2 },
    ]);
    expect(best?.supplierId).toBe('b');
    expect(marginPercent(65_000, best?.rate)).toBe(32);
    expect(marginPercent(0, 100)).toBeNull();
    expect(marginPercent(65_000, null)).toBeNull();
  });

  it('tones it for the list (sage ≥ 30) and the drawer (sage ≥ 30, butter ≥ 15)', () => {
    expect(listMarginTone(30)).toBe('sage');
    expect(listMarginTone(29)).toBe('butter');
    expect(drawerMarginTone(15)).toBe('butter');
    expect(drawerMarginTone(14)).toBe('blush');
  });

  it('splits an MRP that includes GST (D45)', () => {
    expect(mrpSplit(65_000, 18)).toEqual({ base: 55_085, gst: 9_915 });
  });
});
