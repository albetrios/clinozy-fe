import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import {
  stockItemRow,
  stockItemWire,
  stockMovementWire,
  stockPurchaseRow,
  stockPurchaseWire,
  stockVendorRow,
  stockVendorWire,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_MOVEMENT_ID,
  TEST_STOCK_PURCHASE_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  createStockItem,
  createStockPurchase,
  createStockVendor,
  deleteStockItem,
  deleteStockPurchase,
  deleteStockVendor,
  logStockMovement,
  quickCreateStockItem,
  restoreStockItem,
  restoreStockPurchase,
  restoreStockVendor,
  revertStockMovement,
  saveStockCount,
  updateStockItem,
  updateStockPurchase,
  updateStockVendor,
} from './stock-records-api.ts';
import type { StockItemInput, StockPurchaseInput } from './stock-records-contracts.ts';

const KEY = 'act_key_0000000000000000';

/** Soframycin's drawer fields, as read. */
const soframycin = (patch: Partial<StockItemInput> = {}): StockItemInput => ({
  name: 'Soframycin 30 gm',
  category: 'creams_serums',
  unit: 'tube',
  sizePerUnit: 30_000,
  measureUnit: 'g',
  minQty: 1,
  maxQty: 5,
  usagePerWeekMilli: 500,
  vendorId: TEST_STOCK_VENDOR_ID,
  qtyMilli: 3000,
  ...patch,
});

/** A new purchase's fields, as the drawer sends them. */
const purchaseInput = (patch: Partial<StockPurchaseInput> = {}): StockPurchaseInput => ({
  vendorId: TEST_STOCK_VENDOR_ID,
  billNo: 'INV-221',
  date: '2026-10-09',
  lines: [{ itemId: TEST_STOCK_ITEM_ID, qtyMilli: 5000, rate: 250.5 }],
  bill: null,
  payment: null,
  ...patch,
});

/** The body a write to `path` was sent with (the last one). */
function sent(method: 'post' | 'patch', path: string) {
  const call = vi
    .mocked(api[method])
    .mock.calls.filter(([called]) => called === path)
    .at(-1);
  return call?.[1] as
    { params?: object; body?: unknown; idempotencyKey?: string } | undefined;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.delete).mockResolvedValue({ data: undefined });
});

describe('vendors', () => {
  it('adds a vendor with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockVendorWire({ payable: 0 }) });
    const vendor = await createStockVendor({
      input: { name: 'Ankur Pharma', phone: '+919876500011' },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/stock-vendors', {
      body: { name: 'Ankur Pharma', phone: '+919876500011', is_quick: false },
      idempotencyKey: KEY,
    });
    expect(vendor).toMatchObject({ id: TEST_STOCK_VENDOR_ID, payable: 0 });
  });

  it('marks a stacked drawer’s vendor as quick', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockVendorWire({ is_quick: true }) });
    await createStockVendor({
      input: { name: 'Cotton Co', phone: null, isQuick: true },
      idempotencyKey: KEY,
    });
    expect(sent('post', '/app/stock-vendors')?.body).toEqual({
      name: 'Cotton Co',
      phone: null,
      is_quick: true,
    });
  });

  it('saves only what changed, with the read’s updated_at; nothing changed is no write', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: stockVendorWire({ phone: null }) });
    const record = stockVendorRow();
    const saved = await updateStockVendor({
      record,
      input: { name: 'Ankur Pharma', phone: null },
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith('/app/stock-vendors/{stock_vendor_id}', {
      params: { stock_vendor_id: TEST_STOCK_VENDOR_ID },
      body: { phone: null, expected_updated_at: record.updatedAt },
      idempotencyKey: KEY,
    });
    expect(saved.phone).toBeNull();

    vi.mocked(api.patch).mockClear();
    expect(
      await updateStockVendor({
        record,
        input: { name: record.name, phone: record.phone },
        idempotencyKey: KEY,
      }),
    ).toBe(record);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('deletes with the reason and note, and restores with a key', async () => {
    await deleteStockVendor({
      id: TEST_STOCK_VENDOR_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(api.delete).toHaveBeenCalledWith('/app/stock-vendors/{stock_vendor_id}', {
      params: { stock_vendor_id: TEST_STOCK_VENDOR_ID },
      reason: 'duplicate',
      note: undefined,
    });
    vi.mocked(api.post).mockResolvedValue({ data: stockVendorWire() });
    expect(await restoreStockVendor(TEST_STOCK_VENDOR_ID, KEY)).toMatchObject({
      name: 'Ankur Pharma',
    });
    expect(api.post).toHaveBeenCalledWith(
      '/app/stock-vendors/{stock_vendor_id}/restore',
      {
        params: { stock_vendor_id: TEST_STOCK_VENDOR_ID },
        idempotencyKey: KEY,
      },
    );
  });
});

describe('items', () => {
  it('adds an item in the API’s decimals — In stock its opening quantity', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockItemWire() });
    const item = await createStockItem({
      input: soframycin({ qtyMilli: 2500 }),
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/stock-items', {
      body: {
        name: 'Soframycin 30 gm',
        category: 'creams_serums',
        unit: 'tube',
        size_per_unit: 30,
        measure_unit: 'g',
        min_quantity: 1,
        max_quantity: 5,
        usage_per_week: 0.5,
        stock_vendor_id: TEST_STOCK_VENDOR_ID,
        opening_quantity: 2.5,
      },
      idempotencyKey: KEY,
    });
    expect(item).toMatchObject({ qtyMilli: 3000, sizePerUnit: 30_000 });
  });

  it('sends no opening quantity for none, and no measure without contents', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockItemWire() });
    await createStockItem({
      input: soframycin({ qtyMilli: 0, sizePerUnit: null }),
      idempotencyKey: KEY,
    });
    expect(sent('post', '/app/stock-items')?.body).toMatchObject({
      size_per_unit: null,
      measure_unit: null,
      opening_quantity: undefined,
    });
  });

  it('adds "as typed" with the design’s defaults, from the purchase’s vendor', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockItemWire() });
    await quickCreateStockItem({
      input: { name: 'Cotton rolls', vendorId: TEST_STOCK_VENDOR_ID },
      idempotencyKey: KEY,
    });
    expect(sent('post', '/app/stock-items')?.body).toEqual({
      name: 'Cotton rolls',
      category: 'creams_serums',
      unit: 'piece',
      size_per_unit: null,
      measure_unit: null,
      min_quantity: 1,
      max_quantity: 5,
      usage_per_week: 0,
      stock_vendor_id: TEST_STOCK_VENDOR_ID,
      opening_quantity: undefined,
    });
  });

  it('saves the changed fields — never the quantity — with the read’s updated_at', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: stockItemWire({ min_quantity: 2 }) });
    const record = stockItemRow();
    const saved = await updateStockItem({
      record,
      input: soframycin({ minQty: 2 }),
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith('/app/stock-items/{stock_item_id}', {
      params: { stock_item_id: TEST_STOCK_ITEM_ID },
      body: { min_quantity: 2, expected_updated_at: record.updatedAt },
      idempotencyKey: `${KEY}:a`,
    });
    expect(api.post).not.toHaveBeenCalled();
    expect(saved.minQty).toBe(2);
  });

  it('sends the contents and their measure together when either changes', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: stockItemWire() });
    await updateStockItem({
      record: stockItemRow(),
      input: soframycin({ measureUnit: 'ml' }),
      idempotencyKey: KEY,
    });
    expect(sent('patch', '/app/stock-items/{stock_item_id}')?.body).toMatchObject({
      size_per_unit: 30,
      measure_unit: 'ml',
    });
  });

  it('turns a changed In stock into an Adjust to the count, then reads the item again', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: stockMovementWire({ type: 'adjust', quantity_change: -1, quantity_after: 2 }),
    });
    vi.mocked(api.get).mockResolvedValue({
      data: stockItemWire({ quantity: 2, stock_level: 'ok' }),
    });
    const saved = await updateStockItem({
      record: stockItemRow(),
      input: soframycin({ qtyMilli: 2000 }),
      idempotencyKey: KEY,
    });
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/app/stock-items/{stock_item_id}/movements', {
      params: { stock_item_id: TEST_STOCK_ITEM_ID },
      body: { type: 'adjust', quantity: 2 },
      idempotencyKey: `${KEY}:b`,
    });
    expect(saved.qtyMilli).toBe(2000);
  });

  it('writes nothing for an untouched item', async () => {
    const record = stockItemRow();
    expect(
      await updateStockItem({ record, input: soframycin(), idempotencyKey: KEY }),
    ).toBe(record);
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('deletes with the reason and note, and restores with a key', async () => {
    await deleteStockItem({ id: TEST_STOCK_ITEM_ID, reason: 'other', note: 'Expired' });
    expect(api.delete).toHaveBeenCalledWith('/app/stock-items/{stock_item_id}', {
      params: { stock_item_id: TEST_STOCK_ITEM_ID },
      reason: 'other',
      note: 'Expired',
    });
    vi.mocked(api.post).mockResolvedValue({ data: stockItemWire() });
    expect(await restoreStockItem(TEST_STOCK_ITEM_ID, KEY)).toMatchObject({ seq: 167 });
  });
});

describe('movements', () => {
  it('logs a use in the API’s decimals with what it was for; the answer says what is left', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockMovementWire() });
    const movement = await logStockMovement({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        type: 'used',
        quantityMilli: 500,
        usedFor: ' LHR · Dharti Galani ',
        note: '',
      },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/stock-items/{stock_item_id}/movements', {
      params: { stock_item_id: TEST_STOCK_ITEM_ID },
      body: {
        type: 'used',
        quantity: 0.5,
        used_for: 'LHR · Dharti Galani',
        note: undefined,
      },
      idempotencyKey: KEY,
    });
    expect(movement).toMatchObject({ deltaMilli: -500, afterMilli: 2500 });
  });

  it('keeps another type’s "used for" in its remark — only a use takes one', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: stockMovementWire({ type: 'damaged' }),
    });
    await logStockMovement({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        type: 'damaged',
        quantityMilli: 500,
        usedFor: '15 g',
        note: 'Cap broke',
      },
      idempotencyKey: KEY,
    });
    expect(sent('post', '/app/stock-items/{stock_item_id}/movements')?.body).toEqual({
      type: 'damaged',
      quantity: 0.5,
      note: '15 g · Cap broke',
    });
    await logStockMovement({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        type: 'adjust',
        quantityMilli: 0,
        usedFor: null,
        note: null,
      },
      idempotencyKey: KEY,
    });
    expect(sent('post', '/app/stock-items/{stock_item_id}/movements')?.body).toEqual({
      type: 'adjust',
      quantity: 0,
      note: undefined,
    });
  });

  it('reverts with the reason — the Undo of a use too — and the note when given', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: stockMovementWire({
        id: 'smov_revert0000000000000',
        type: 'reverted',
        quantity_change: 0.5,
        quantity_after: 3,
        reverts_stock_item_movement_id: TEST_STOCK_MOVEMENT_ID,
        revert_reason: 'mistake',
      }),
    });
    const revert = await revertStockMovement({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        movementId: TEST_STOCK_MOVEMENT_ID,
        reason: 'mistake',
        note: '  ',
      },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith(
      '/app/stock-items/{stock_item_id}/movements/{stock_item_movement_id}/revert',
      {
        params: {
          stock_item_id: TEST_STOCK_ITEM_ID,
          stock_item_movement_id: TEST_STOCK_MOVEMENT_ID,
        },
        body: { reason: 'mistake', note: undefined },
        idempotencyKey: KEY,
      },
    );
    expect(revert).toMatchObject({ kind: 'reverted', afterMilli: 3000 });
    await revertStockMovement({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        movementId: TEST_STOCK_MOVEMENT_ID,
        reason: 'other',
        note: 'Counted twice',
      },
      idempotencyKey: KEY,
    });
    expect(
      sent(
        'post',
        '/app/stock-items/{stock_item_id}/movements/{stock_item_movement_id}/revert',
      )?.body,
    ).toEqual({ reason: 'other', note: 'Counted twice' });
  });
});

describe('purchases', () => {
  it('records a purchase in the API’s decimals and rupees; the bill defaults to its lines', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockPurchaseWire() });
    const purchase = await createStockPurchase({
      input: purchaseInput(),
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/stock-purchases', {
      body: {
        stock_vendor_id: TEST_STOCK_VENDOR_ID,
        bill_number: 'INV-221',
        purchase_date: '2026-10-09',
        items: [{ stock_item_id: TEST_STOCK_ITEM_ID, quantity: 5, rate: 250.5 }],
        bill_amount: undefined,
        payment: undefined,
      },
      idempotencyKey: KEY,
    });
    expect(purchase).toMatchObject({ bill: 2392.5, paid: 892.5, status: 'partial' });
  });

  it('sends a typed bill and "Paid" as one supplier-bill payment from a branch', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: stockPurchaseWire() });
    await createStockPurchase({
      input: purchaseInput({
        bill: 2392.5,
        payment: { branchId: 'brn_main0000000000000000', mode: 'upi', amount: 800 },
      }),
      idempotencyKey: KEY,
    });
    expect(sent('post', '/app/stock-purchases')?.body).toMatchObject({
      bill_amount: 2392.5,
      payment: {
        branch_id: 'brn_main0000000000000000',
        splits: [{ mode: 'upi', amount: 800 }],
      },
    });
  });

  it('saves only the changed details — never the lines — with the read’s updated_at', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: stockPurchaseWire({ bill_number: null }),
    });
    const record = stockPurchaseRow();
    await updateStockPurchase({
      record,
      input: { vendorId: record.vendorId, billNo: null, date: record.date, bill: 2400 },
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith('/app/stock-purchases/{stock_purchase_id}', {
      params: { stock_purchase_id: TEST_STOCK_PURCHASE_ID },
      body: {
        bill_number: null,
        bill_amount: 2400,
        expected_updated_at: record.updatedAt,
      },
      idempotencyKey: KEY,
    });
    vi.mocked(api.patch).mockClear();
    expect(
      await updateStockPurchase({
        record,
        input: {
          vendorId: record.vendorId,
          billNo: record.billNo,
          date: record.date,
          bill: record.bill,
        },
        idempotencyKey: KEY,
      }),
    ).toBe(record);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('deletes with the reason, and restores with a key', async () => {
    await deleteStockPurchase({
      id: TEST_STOCK_PURCHASE_ID,
      reason: 'mistake',
      note: null,
    });
    expect(api.delete).toHaveBeenCalledWith('/app/stock-purchases/{stock_purchase_id}', {
      params: { stock_purchase_id: TEST_STOCK_PURCHASE_ID },
      reason: 'mistake',
      note: undefined,
    });
    vi.mocked(api.post).mockResolvedValue({ data: stockPurchaseWire() });
    expect(await restoreStockPurchase(TEST_STOCK_PURCHASE_ID, KEY)).toMatchObject({
      seq: 16,
    });
  });
});

describe('saveStockCount', () => {
  it('sends the counted items in the API’s decimals and answers how many changed', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'scnt_f5qiucn7bbhh7cv62hpbm',
        changed_item_count: 1,
        counted_at: '2026-10-10T05:40:00.000Z',
        created_at: '2026-10-10T05:40:00.000Z',
        author_membership_id: 'mem_nisha0000000000000000',
        lines: [],
      },
    });
    expect(
      await saveStockCount({
        input: { lines: [{ itemId: TEST_STOCK_ITEM_ID, countedMilli: 4500 }] },
        idempotencyKey: KEY,
      }),
    ).toEqual({ id: 'scnt_f5qiucn7bbhh7cv62hpbm', changed: 1 });
    expect(api.post).toHaveBeenCalledWith('/app/stock-counts', {
      body: { lines: [{ stock_item_id: TEST_STOCK_ITEM_ID, counted_quantity: 4.5 }] },
      idempotencyKey: KEY,
    });
  });
});
