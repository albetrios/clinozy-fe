import { describe, expect, it } from 'vitest';

import type { StockItemRow, StockPurchaseRow } from '../../stock-contracts.ts';
import {
  billOf,
  dueOf,
  emptyLine,
  linesMissingRate,
  linesTotal,
  newPurchaseForm,
  purchaseFormOf,
  purchaseInputOf,
  reorderLines,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';

const LINES = [
  { itemId: 'gauze', qty: 10, rate: 25_000 },
  { itemId: 'gloves', qty: 2, rate: 0 },
  emptyLine(),
];

const form = (patch: Partial<StockPurchaseFormValues> = {}): StockPurchaseFormValues => ({
  ...newPurchaseForm(LINES),
  vendorId: 'v1',
  ...patch,
});

describe('the purchase form (clinic-stock.md:142–157)', () => {
  it('totals the picked lines; the bill follows them until one is typed', () => {
    expect(linesTotal(LINES)).toBe(250_000);
    expect(billOf(form())).toBe(250_000);
    expect(billOf(form({ bill: '2400' }))).toBe(240_000);
    expect(dueOf(form({ paid: '1000' }))).toBe(150_000);
    expect(dueOf(form({ paid: '9000' }))).toBe(0);
  });

  it('names the picked lines still without a rate', () => {
    expect(linesMissingRate(LINES)).toEqual([1]);
  });

  it('reorders every item at or below its minimum up to its maximum', () => {
    const items = [
      { id: 'low', level: 'low', qtyMilli: 1000, maxQty: 4 },
      { id: 'out', level: 'out', qtyMilli: 0, maxQty: 6 },
      { id: 'ok', level: 'ok', qtyMilli: 9000, maxQty: 10 },
    ] as StockItemRow[];
    expect(reorderLines(items)).toEqual([
      { itemId: 'low', qty: 3, rate: 0 },
      { itemId: 'out', qty: 6, rate: 0 },
    ]);
  });

  it('sends the picked lines ×1000 with the bill, and a saved purchase reads back', () => {
    const input = purchaseInputOf(form({ billNo: ' AP-3001 ', paid: '500' }));
    expect(input).toMatchObject({
      vendorId: 'v1',
      billNo: 'AP-3001',
      lines: [
        { itemId: 'gauze', qtyMilli: 10_000, rate: 25_000 },
        { itemId: 'gloves', qtyMilli: 2000, rate: 0 },
      ],
      bill: 250_000,
      paid: 50_000,
    });
    expect(purchaseInputOf(form({ vendorId: null, billNo: '' }))).toMatchObject({
      vendorId: '',
      billNo: null,
    });

    const saved = {
      vendorId: 'v1',
      billNo: null,
      date: '2026-09-25',
      lines: [{ itemId: 'gauze', qtyMilli: 24_000, rate: 5000 }],
      bill: 120_000,
      paid: 60_000,
    } as unknown as StockPurchaseRow;
    expect(purchaseFormOf(saved)).toEqual({
      vendorId: 'v1',
      billNo: '',
      date: '2026-09-25',
      lines: [{ itemId: 'gauze', qty: 24, rate: 5000 }],
      bill: '1200',
      paid: '600',
    });
  });
});
