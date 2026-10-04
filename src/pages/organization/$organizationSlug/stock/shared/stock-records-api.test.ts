import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

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
  undoStockMovement,
  updateStockItem,
  updateStockPurchase,
  updateStockVendor,
} from './stock-records-api.ts';
import type { StockItemInput, StockPurchaseInput } from './stock-records-contracts.ts';

afterEach(() => resetClinicFixtures());

const SOFRAMYCIN = ref.stockItem(167);
const GAUZE = ref.stockItem(158);
const ANKUR = ref.stockVendor(1);

const qtyOf = (id: string) =>
  clinicFixtures.stockItems.snapshot((item) => item.id === id)[0]?.qtyMilli;
const movementsOf = (id: string) =>
  clinicFixtures.stockMovements.snapshot((movement) => movement.itemId === id);

/** A new item's fields, as the drawer sends them. */
const itemInput = (patch: Partial<StockItemInput> = {}): StockItemInput => ({
  name: 'Cotton rolls',
  category: 'consumables',
  unit: 'pack',
  sizePerUnit: null,
  measureUnit: 'ml',
  minQty: 1,
  maxQty: 10,
  usagePerWeekMilli: 500,
  vendorId: ANKUR,
  qtyMilli: 4000,
  ...patch,
});

/** A purchase's fields, as the drawer sends them. */
const purchaseInput = (patch: Partial<StockPurchaseInput> = {}): StockPurchaseInput => ({
  vendorId: ANKUR,
  billNo: 'AP-3001',
  date: '2026-10-04',
  lines: [{ itemId: GAUZE, qtyMilli: 10_000, rate: 25_000 }],
  bill: 250_000,
  paid: 0,
  ...patch,
});

describe('clinic vendors (`S:1693`)', () => {
  it('adds, saves, deletes and restores a vendor', async () => {
    const vendor = await createStockVendor({ name: 'Ankit Traders', phone: null });
    expect(vendor).toMatchObject({ name: 'Ankit Traders', isQuick: false });

    const saved = await updateStockVendor(vendor.id, { phone: '+919876543210' });
    expect(saved).toMatchObject({ name: 'Ankit Traders', phone: '+919876543210' });

    await deleteStockVendor(vendor.id, 'mistake', null);
    expect(clinicFixtures.stockVendors.snapshot((row) => row.id === vendor.id)).toEqual(
      [],
    );
    await restoreStockVendor(vendor.id);
    expect(
      clinicFixtures.stockVendors.snapshot((row) => row.id === vendor.id),
    ).toHaveLength(1);
  });

  it('refuses a nameless vendor, and a vendor still owed money', async () => {
    await expect(createStockVendor({ name: ' ', phone: null })).rejects.toMatchObject({
      status: 422,
    });
    // Cranix Pharma is owed ₹1,710 on Purchase #15.
    await expect(
      deleteStockVendor(ref.stockVendor(2), 'mistake', null),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('items (`S:1685`)', () => {
  it('opens an item with its stock and no movement behind it', async () => {
    const item = await createStockItem(itemInput());
    expect(item).toMatchObject({ name: 'Cotton rolls', qtyMilli: 4000, vendorId: ANKUR });
    expect(movementsOf(item.id)).toEqual([]);
  });

  it('drops the measure of an item without contents, and refuses an unknown vendor', async () => {
    expect((await createStockItem(itemInput())).measureUnit).toBeNull();
    await expect(
      createStockItem(itemInput({ vendorId: ref.stockVendor(99) })),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('saves a changed In stock as an Adjust movement, never on the item itself', async () => {
    const item = await createStockItem(itemInput());
    const unchanged = await updateStockItem(item.id, itemInput({ name: 'Cotton roll' }));
    expect(unchanged.name).toBe('Cotton roll');
    expect(movementsOf(item.id)).toEqual([]);

    const counted = await updateStockItem(item.id, itemInput({ qtyMilli: 2500 }));
    expect(counted.qtyMilli).toBe(2500);
    expect(movementsOf(item.id)).toEqual([
      expect.objectContaining({ type: 'adjust', deltaMilli: -1500, usedFor: null }),
    ]);
  });

  it('adds a typed name as a quick piece of Creams & Serums, 1 to 5', async () => {
    const item = await quickCreateStockItem({ name: 'Cotton', vendorId: ANKUR });
    expect(item).toMatchObject({
      name: 'Cotton',
      category: 'creams_serums',
      unit: 'piece',
      minQty: 1,
      maxQty: 5,
      qtyMilli: 0,
      vendorId: ANKUR,
    });
    await expect(quickCreateStockItem({ name: '  ' })).rejects.toMatchObject({
      status: 422,
    });
  });

  it('deletes an item and restores it', async () => {
    await deleteStockItem(SOFRAMYCIN, 'duplicate', null);
    expect(qtyOf(SOFRAMYCIN)).toBeUndefined();
    await restoreStockItem(SOFRAMYCIN);
    expect(qtyOf(SOFRAMYCIN)).toBe(3000);
  });
});

describe('movements (`useStock`, `S:1688–1689`)', () => {
  it('a use takes stock out, notes what it was for, and Undo puts it back', async () => {
    const { movement, item } = await logStockMovement({
      itemId: SOFRAMYCIN,
      type: 'used',
      quantityMilli: 1000,
      usedFor: 'LHR',
      note: 'Dharti Galani',
    });
    expect(item.qtyMilli).toBe(2000);
    expect(movement).toMatchObject({
      type: 'used',
      deltaMilli: -1000,
      usedFor: 'LHR · Dharti Galani',
    });

    expect((await undoStockMovement(movement.id)).qtyMilli).toBe(3000);
    expect(
      clinicFixtures.stockMovements.snapshot((row) => row.id === movement.id),
    ).toEqual([]);
  });

  it('a receipt adds and an Adjust sets the counted quantity', async () => {
    const received = await logStockMovement({
      itemId: SOFRAMYCIN,
      type: 'received',
      quantityMilli: 2500,
      usedFor: null,
      note: null,
    });
    expect(received.item.qtyMilli).toBe(5500);
    const adjusted = await logStockMovement({
      itemId: SOFRAMYCIN,
      type: 'adjust',
      quantityMilli: 4000,
      usedFor: null,
      note: null,
    });
    expect(adjusted).toMatchObject({
      item: { qtyMilli: 4000 },
      movement: { type: 'adjust', deltaMilli: -1500, usedFor: null },
    });
  });

  it('refuses no quantity, and taking out more than the shelf holds', async () => {
    const base = { itemId: SOFRAMYCIN, usedFor: null, note: null };
    await expect(
      logStockMovement({ ...base, type: 'used', quantityMilli: 0 }),
    ).rejects.toMatchObject({ status: 422, message: 'Enter a quantity' });
    await expect(
      logStockMovement({ ...base, type: 'damaged', quantityMilli: 3500 }),
    ).rejects.toMatchObject({ status: 422, message: 'Not that much in stock' });
    // A count of zero is a count.
    const emptied = await logStockMovement({ ...base, type: 'adjust', quantityMilli: 0 });
    expect(emptied.item.qtyMilli).toBe(0);
  });

  it('reverts a movement once: a linked Reverted entry with the opposite change', async () => {
    // Noprik: 1 tube used today.
    const used = ref.stockMovement(1);
    const { movement, item } = await revertStockMovement({
      movementId: used,
      reason: 'mistake',
      note: null,
    });
    expect(item.qtyMilli).toBe(6000);
    expect(movement).toMatchObject({
      type: 'reverted',
      deltaMilli: 1000,
      revertsId: used,
      revertReason: 'mistake',
    });
    expect(
      clinicFixtures.stockMovements.snapshot((row) => row.id === used)[0],
    ).toMatchObject({ revertedById: movement.id });

    await expect(
      revertStockMovement({ movementId: used, reason: 'mistake', note: null }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      revertStockMovement({ movementId: movement.id, reason: 'mistake', note: null }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('"Other" waits for a note, which the Reverted entry keeps', async () => {
    const damaged = ref.stockMovement(4);
    await expect(
      revertStockMovement({ movementId: damaged, reason: 'other', note: ' ' }),
    ).rejects.toMatchObject({ status: 422 });
    const { movement } = await revertStockMovement({
      movementId: damaged,
      reason: 'other',
      note: 'Seal was fine',
    });
    expect(movement).toMatchObject({ revertReason: 'other', usedFor: 'Seal was fine' });
  });
});

describe('purchases (`S:1686`)', () => {
  it('a new purchase receives each line into stock, named by its bill', async () => {
    const purchase = await createStockPurchase(purchaseInput());
    expect(purchase).toMatchObject({ vendorId: ANKUR, billNo: 'AP-3001', bill: 250_000 });
    expect(qtyOf(GAUZE)).toBe(24_000);
    expect(movementsOf(GAUZE)).toEqual([
      expect.objectContaining({
        type: 'received',
        deltaMilli: 10_000,
        usedFor: 'AP-3001',
        purchaseId: purchase.id,
      }),
    ]);
  });

  it('an edit saves the bill without moving stock again', async () => {
    const purchase = await createStockPurchase(purchaseInput());
    const saved = await updateStockPurchase(
      purchase.id,
      purchaseInput({ billNo: 'AP-3002', paid: 250_000 }),
    );
    expect(saved).toMatchObject({ billNo: 'AP-3002', paid: 250_000 });
    expect(qtyOf(GAUZE)).toBe(24_000);
    expect(movementsOf(GAUZE)).toHaveLength(1);
  });

  it('refuses no supplier and an item the clinic does not stock', async () => {
    await expect(
      createStockPurchase(purchaseInput({ vendorId: '' })),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      createStockPurchase(
        purchaseInput({
          lines: [{ itemId: ref.stockItem(999), qtyMilli: 1000, rate: 100 }],
        }),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('deletes a purchase and restores it', async () => {
    const id = ref.stockPurchase(15);
    await deleteStockPurchase(id, 'mistake', null);
    expect(clinicFixtures.stockPurchases.snapshot((row) => row.id === id)).toEqual([]);
    await restoreStockPurchase(id);
    expect(clinicFixtures.stockPurchases.snapshot((row) => row.id === id)).toHaveLength(
      1,
    );
  });
});

describe('Stock check (`saveStockCount`, `S:1690`)', () => {
  it('saves only the counts that differ, each an Adjust noted "Stock check"', async () => {
    const result = await saveStockCount({
      lines: [
        { itemId: SOFRAMYCIN, countedMilli: 2500 },
        { itemId: GAUZE, countedMilli: 14_000 },
      ],
    });
    expect(result).toEqual({ changed: 1 });
    expect(qtyOf(SOFRAMYCIN)).toBe(2500);
    const [count] = clinicFixtures.stockCounts.snapshot();
    expect(count?.lines).toEqual([
      { itemId: SOFRAMYCIN, systemMilli: 3000, countedMilli: 2500 },
    ]);
    expect(movementsOf(SOFRAMYCIN).at(-1)).toMatchObject({
      type: 'adjust',
      deltaMilli: -500,
      usedFor: 'Stock check',
      stockCountId: count?.id,
    });
    expect(movementsOf(GAUZE)).toEqual([]);
  });

  it('writes nothing when every count matches', async () => {
    expect(
      await saveStockCount({ lines: [{ itemId: SOFRAMYCIN, countedMilli: 3000 }] }),
    ).toEqual({ changed: 0 });
    expect(clinicFixtures.stockCounts.snapshot()).toEqual([]);
  });
});
