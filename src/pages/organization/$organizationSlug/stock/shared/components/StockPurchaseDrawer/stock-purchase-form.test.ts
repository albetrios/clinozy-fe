import { describe, expect, it } from 'vitest';

import { appToday } from '@/shared/api/app/app-time.ts';
import { stockPurchaseRow } from '@/tests/utils/stock-doubles.ts';

import type { StockItemRow } from '../../stock-contracts.ts';
import {
  billOf,
  emptyLine,
  lineAmount,
  linesMissingRate,
  linesTotal,
  newPurchaseForm,
  paidOf,
  pickedCount,
  purchaseChangeOf,
  purchaseFieldOrder,
  purchaseFormOf,
  purchaseInputOf,
  purchaseServerFields,
  reorderLines,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';

/** Ten gauze at ₹250, gloves with no rate yet, and a blank row. */
const LINES = [
  { itemId: 'gauze', qty: 10, rate: 25_000, amount: null },
  { itemId: 'gloves', qty: 2, rate: 0, amount: null },
  emptyLine(),
];

const form = (patch: Partial<StockPurchaseFormValues> = {}): StockPurchaseFormValues => ({
  ...newPurchaseForm(LINES),
  vendorId: 'svnd_ankur0000000000000000',
  ...patch,
});

describe('the purchase form (clinic-stock.md:142–157)', () => {
  it('starts on today’s bill, paid in cash, nothing in it', () => {
    expect(newPurchaseForm()).toEqual({
      vendorId: null,
      billNo: '',
      date: appToday(),
      lines: [],
      bill: '',
      paid: '',
      paidMode: 'cash',
      paidBranchId: null,
    });
  });

  it('totals the picked lines — a saved line by the server’s amount; the bill follows them until typed', () => {
    expect(linesTotal(LINES)).toBe(250_000);
    expect(lineAmount({ itemId: 'gauze', qty: 4.5, rate: 25_050, amount: 1127.25 })).toBe(
      112_725,
    );
    expect(billOf(form())).toBe(250_000);
    expect(billOf(form({ bill: '2400.5' }))).toBe(240_050);
    expect(paidOf(form({ paid: '1000' }))).toBe(100_000);
    expect(pickedCount(LINES)).toBe(2);
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
      { itemId: 'low', qty: 3, rate: 0, amount: null },
      { itemId: 'out', qty: 6, rate: 0, amount: null },
    ]);
  });

  it('sends the picked lines ×1000 at their rates in rupees; an empty bill follows the lines', () => {
    const input = purchaseInputOf(form({ billNo: ' AP-3001 ' }), null);
    expect(input).toEqual({
      vendorId: 'svnd_ankur0000000000000000',
      billNo: 'AP-3001',
      date: appToday(),
      lines: [
        { itemId: 'gauze', qtyMilli: 10_000, rate: 250 },
        { itemId: 'gloves', qtyMilli: 2000, rate: 0 },
      ],
      bill: null,
      payment: null,
    });
    expect(purchaseInputOf(form({ bill: '2392.5', billNo: '' }), null)).toMatchObject({
      billNo: null,
      bill: 2392.5,
    });
  });

  it('records "Paid" only for a member who may pay, from the picked branch or their default one', () => {
    const paying = { branchId: 'brn_adajan000000000000000' };
    expect(purchaseInputOf(form({ paid: '500' }), null).payment).toBeNull();
    expect(purchaseInputOf(form({ paid: '' }), paying).payment).toBeNull();
    expect(purchaseInputOf(form({ paid: '500.5' }), paying).payment).toEqual({
      branchId: 'brn_adajan000000000000000',
      mode: 'cash',
      amount: 500.5,
    });
    expect(
      purchaseInputOf(
        form({
          paid: '100',
          paidMode: 'upi',
          paidBranchId: 'brn_vesu00000000000000000',
        }),
        paying,
      ).payment,
    ).toEqual({ branchId: 'brn_vesu00000000000000000', mode: 'upi', amount: 100 });
    expect(purchaseInputOf(form({ paid: '100' }), { branchId: null }).payment).toBeNull();
  });

  it('reads a saved purchase back — rates in paise, a part quantity kept — and edits only its bill', () => {
    const saved = stockPurchaseRow({
      billNo: null,
      lines: [
        { lineNumber: 1, itemId: 'gauze', qtyMilli: 4500, rate: 250.5, amount: 1127.25 },
      ],
      bill: 1200,
    });
    const values = purchaseFormOf(saved);
    expect(values).toMatchObject({
      vendorId: saved.vendorId,
      billNo: '',
      date: '2026-10-09',
      lines: [{ itemId: 'gauze', qty: 4.5, rate: 25_050, amount: 1127.25 }],
      bill: '1200',
      paid: '',
    });
    expect(purchaseChangeOf({ ...values, billNo: ' INV-9 ' })).toEqual({
      vendorId: saved.vendorId,
      billNo: 'INV-9',
      date: '2026-10-09',
      bill: 1200,
    });
    // An emptied bill goes back to the lines' total, the server's amounts.
    expect(purchaseChangeOf({ ...values, bill: '' }).bill).toBe(1127.25);
  });

  it('puts the API’s fields on the form’s — each sent line on its row', () => {
    const lines = [emptyLine(), ...LINES.slice(0, 2)];
    const fields = purchaseServerFields(lines);
    expect(fields).toMatchObject({
      stockVendorId: 'vendorId',
      billNumber: 'billNo',
      purchaseDate: 'date',
      billAmount: 'bill',
      items: 'lines',
      'payment.branchId': 'paidBranchId',
      'payment.splits.0.amount': 'paid',
      'items.0.rate': 'lines.1.rate',
      'items.1.quantity': 'lines.2.qty',
      'items.1.stockItemId': 'lines.2.itemId',
    });
    expect(purchaseFieldOrder(lines.slice(0, 1))).toEqual([
      'vendorId',
      'billNo',
      'date',
      'lines.0.itemId',
      'lines.0.qty',
      'lines.0.rate',
      'lines',
      'bill',
      'paid',
      'paidMode',
      'paidBranchId',
    ]);
  });
});
