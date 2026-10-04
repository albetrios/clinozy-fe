import {
  clinicHttpError,
  definedFields,
  refuseUnknownIds,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import type {
  DeleteReason,
  StockItem,
  StockMovement,
  StockPurchase,
  StockVendor,
} from '@/shared/api/clinic/clinic-schema.ts';

import { exceedsStock, movementDelta } from './stock-movement.ts';
import {
  STOCK_NAME_MESSAGE,
  type StockCountInput,
  stockCountInputSchema,
  type StockCountResult,
  type StockItemInput,
  stockItemInputSchema,
  type StockMovementInput,
  stockMovementInputSchema,
  type StockMovementResult,
  type StockPurchaseInput,
  stockPurchaseInputSchema,
  type StockRevertInput,
  type StockVendorInput,
  stockVendorInputSchema,
} from './stock-records-contracts.ts';

/*
 * Clinic stock's writes (`S:1685–1693`) on the fixture world until clinozy-be
 * serves them (REPLACE_WITH_API, D6). The world is imported on demand, so its
 * seed never lands in a route chunk. Stock moves only through movements: a
 * use, a receipt, an adjustment, a revert, a purchase's lines and a stock
 * check each write one and raise or lower the item (`S:886`). A delete is soft
 * (`S:1546`) and restores as the toast's Undo (D32).
 */

const fixtureWorld = () => import('@/shared/api/clinic/fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** A 422 the drawers show on a field. */
function refuse(field: string, message: string): never {
  throw clinicHttpError(422, 'validation', message, { [field]: [message] });
}

/** A 422 when the picked vendor is unknown — the server's foreign-key check. */
function refuseUnknownVendor(world: FixtureWorld, vendorId: string | null) {
  if (vendorId === null) return;
  refuseUnknownIds(
    'vendorId',
    [vendorId],
    world.stockVendors.snapshot(),
    'Pick a vendor',
  );
}

/** The movement's fields beyond its kind and change (server-set links empty). */
const MOVEMENT_LINKS = {
  patientId: null,
  purchaseId: null,
  stockCountId: null,
  revertsId: null,
  revertedById: null,
  revertReason: null,
} as const;

/** Write a stock change and move the item by it; the item never goes below 0. */
async function moveStock(
  world: FixtureWorld,
  item: StockItem,
  fields: Pick<StockMovement, 'type' | 'deltaMilli' | 'usedFor'> &
    Partial<
      Pick<StockMovement, 'purchaseId' | 'stockCountId' | 'revertsId' | 'revertReason'>
    >,
): Promise<StockMovementResult> {
  const movement = await world.stockMovements.create({
    ...MOVEMENT_LINKS,
    ...fields,
    itemId: item.id,
  });
  const saved = await world.stockItems.update(item.id, {
    qtyMilli: Math.max(0, item.qtyMilli + fields.deltaMilli),
  });
  return { movement, item: saved };
}

// ── Vendors ──

/** Create a clinic vendor (`S:1693`; REPLACE_WITH_API). */
export async function createStockVendor(input: StockVendorInput): Promise<StockVendor> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(stockVendorInputSchema, input);
  return clinicFixtures.stockVendors.create({ ...fields, isQuick: false });
}

/** Save a clinic vendor (`S:1693`; REPLACE_WITH_API). */
export async function updateStockVendor(
  id: string,
  patch: Partial<StockVendorInput>,
): Promise<StockVendor> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.stockVendors.get(id);
  const fields = validateClinicInput(stockVendorInputSchema, {
    ...saved,
    ...definedFields(patch),
  });
  return clinicFixtures.stockVendors.update(id, { ...fields, isQuick: false });
}

/**
 * Soft-delete a clinic vendor (`S:1546`; REPLACE_WITH_API) — refused while a
 * purchase still owes them (a 409 the UI never offers: Delete is hidden then).
 */
export async function deleteStockVendor(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<StockVendor> {
  const { clinicFixtures } = await fixtureWorld();
  const owed = clinicFixtures.stockPurchases.snapshot(
    (purchase) => purchase.vendorId === id && purchase.bill > purchase.paid,
  );
  if (owed.length > 0) {
    throw clinicHttpError(409, 'conflict', 'Settle this vendor’s purchases first');
  }
  return clinicFixtures.stockVendors.remove(id, reason, note);
}

/** Restore a deleted vendor — the Undo of its toast (D32). */
export async function restoreStockVendor(id: string): Promise<StockVendor> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.stockVendors.restore(id);
}

// ── Items ──

/** The record's fields for an item save, checked. */
function itemFields(world: FixtureWorld, input: StockItemInput) {
  const { qtyMilli, ...rest } = input;
  const fields = validateClinicInput(stockItemInputSchema, rest);
  refuseUnknownVendor(world, fields.vendorId);
  if (fields.sizePerUnit === null)
    return { fields: { ...fields, measureUnit: null }, qtyMilli };
  return { fields, qtyMilli };
}

/**
 * Create an item (`S:1685`; REPLACE_WITH_API): In stock is its opening
 * quantity — the stock it starts with, no movement behind it.
 */
export async function createStockItem(input: StockItemInput): Promise<StockItem> {
  const { clinicFixtures } = await fixtureWorld();
  const { fields, qtyMilli } = itemFields(clinicFixtures, input);
  return clinicFixtures.stockItems.create({ ...fields, qtyMilli: Math.max(0, qtyMilli) });
}

/**
 * Save an item (`S:1685`; REPLACE_WITH_API). A changed In stock is not written
 * to the item: it becomes an Adjust movement (Appendix F), so the history
 * says who changed the count.
 */
export async function updateStockItem(
  id: string,
  input: StockItemInput,
): Promise<StockItem> {
  const { clinicFixtures } = await fixtureWorld();
  const { fields, qtyMilli } = itemFields(clinicFixtures, input);
  const saved = await clinicFixtures.stockItems.update(id, fields);
  const delta = qtyMilli - saved.qtyMilli;
  if (delta === 0) return saved;
  return (
    await moveStock(clinicFixtures, saved, {
      type: 'adjust',
      deltaMilli: delta,
      usedFor: null,
    })
  ).item;
}

/**
 * "Not in the list · add as typed" / the stacked "New clinic item"
 * (`clinic-stock.md:149, 187–201`; REPLACE_WITH_API): a piece, Creams & Serums,
 * minimum 1, maximum 5 unless the stacked drawer said otherwise, from the
 * purchase's vendor.
 */
export async function quickCreateStockItem(
  input: Partial<Omit<StockItemInput, 'name'>> & { name: string },
): Promise<StockItem> {
  if (!input.name.trim()) refuse('name', STOCK_NAME_MESSAGE);
  return createStockItem({
    category: 'creams_serums',
    unit: 'piece',
    sizePerUnit: null,
    measureUnit: null,
    minQty: 1,
    maxQty: 5,
    usagePerWeekMilli: 0,
    vendorId: null,
    qtyMilli: 0,
    ...input,
  });
}

/** Soft-delete an item (`S:1546`; REPLACE_WITH_API). */
export async function deleteStockItem(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<StockItem> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.stockItems.remove(id, reason, note);
}

/** Restore a deleted item — the Undo of its toast (D32). */
export async function restoreStockItem(id: string): Promise<StockItem> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.stockItems.restore(id);
}

// ── Movements ──

/**
 * A use, receipt, adjustment, damage or return (`useStock`, `S:1688`; the hand-
 * entered rest are a backend request, C27; REPLACE_WITH_API). Used, Damaged
 * and Returned take out at most what is in stock; Adjust sets the counted
 * quantity. The remark rides with what it was used for.
 */
export async function logStockMovement(
  input: StockMovementInput,
): Promise<StockMovementResult> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(stockMovementInputSchema, input);
  const item = await clinicFixtures.stockItems.get(fields.itemId);
  if (fields.type !== 'adjust' && fields.quantityMilli === 0) {
    refuse('quantityMilli', 'Enter a quantity');
  }
  if (exceedsStock(fields.type, item, fields.quantityMilli)) {
    refuse('quantityMilli', 'Not that much in stock');
  }
  return moveStock(clinicFixtures, item, {
    type: fields.type,
    deltaMilli: movementDelta(fields.type, item, fields.quantityMilli),
    usedFor: [fields.usedFor, fields.note].filter(Boolean).join(' · ') || null,
  });
}

/**
 * The Undo of a use or a movement (`clinic-stock.md:102, 139`;
 * REPLACE_WITH_API): the movement goes and the item takes its change back.
 */
export async function undoStockMovement(id: string): Promise<StockItem> {
  const { clinicFixtures } = await fixtureWorld();
  const movement = await clinicFixtures.stockMovements.get(id);
  const item = await clinicFixtures.stockItems.get(movement.itemId);
  await clinicFixtures.stockMovements.remove(id, 'mistake', null);
  return clinicFixtures.stockItems.update(item.id, {
    qtyMilli: Math.max(0, item.qtyMilli - movement.deltaMilli),
  });
}

/**
 * Revert a movement (`revertMovement`, `S:1689`; REPLACE_WITH_API): a Reverted
 * entry with the opposite change, linked both ways — both stay in the history.
 * A movement already reverted, or itself a revert, is a 409.
 */
export async function revertStockMovement({
  movementId,
  reason,
  note,
}: StockRevertInput): Promise<StockMovementResult> {
  const { clinicFixtures } = await fixtureWorld();
  const original = await clinicFixtures.stockMovements.get(movementId);
  if (original.revertedById !== null || original.type === 'reverted') {
    throw clinicHttpError(409, 'conflict', 'This movement is already reverted');
  }
  if (reason === 'other' && !note?.trim()) refuse('note', 'Tell the team why');
  const item = await clinicFixtures.stockItems.get(original.itemId);
  const result = await moveStock(clinicFixtures, item, {
    type: 'reverted',
    deltaMilli: -original.deltaMilli,
    usedFor: note?.trim() || null,
    revertsId: original.id,
    revertReason: reason,
  });
  await clinicFixtures.stockMovements.update(original.id, {
    revertedById: result.movement.id,
  });
  return result;
}

// ── Purchases ──

/** The record's fields for a purchase save, checked. */
function purchaseFields(world: FixtureWorld, input: StockPurchaseInput) {
  const fields = validateClinicInput(stockPurchaseInputSchema, input);
  refuseUnknownVendor(world, fields.vendorId);
  refuseUnknownIds(
    'lines',
    fields.lines.map((line) => line.itemId),
    world.stockItems.snapshot(),
    'Pick items the clinic stocks',
  );
  return fields;
}

/**
 * Create a purchase (`S:1686`; REPLACE_WITH_API): each line it brought in is a
 * Received movement — named by its bill — that raises the item.
 */
export async function createStockPurchase(
  input: StockPurchaseInput,
): Promise<StockPurchase> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = purchaseFields(clinicFixtures, input);
  const purchase = await clinicFixtures.stockPurchases.create(fields);
  for (const line of fields.lines) {
    const item = await clinicFixtures.stockItems.get(line.itemId);
    await moveStock(clinicFixtures, item, {
      type: 'received',
      deltaMilli: line.qtyMilli,
      usedFor: fields.billNo,
      purchaseId: purchase.id,
    });
  }
  return purchase;
}

/**
 * Save a purchase (`S:1686`; REPLACE_WITH_API): the bill, its lines and what was
 * paid. Stock moved when it was received; an edit does not move it again
 * (AMBER: the prototype keeps the lines as written).
 */
export async function updateStockPurchase(
  id: string,
  input: StockPurchaseInput,
): Promise<StockPurchase> {
  const { clinicFixtures } = await fixtureWorld();
  await clinicFixtures.stockPurchases.get(id);
  return clinicFixtures.stockPurchases.update(id, purchaseFields(clinicFixtures, input));
}

/** Soft-delete a purchase (`S:1546`; REPLACE_WITH_API). */
export async function deleteStockPurchase(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<StockPurchase> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.stockPurchases.remove(id, reason, note);
}

/** Restore a deleted purchase — the Undo of its toast (D32). */
export async function restoreStockPurchase(id: string): Promise<StockPurchase> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.stockPurchases.restore(id);
}

// ── Stock check ──

/**
 * Save a Stock check (`saveStockCount`, `S:1690`; REPLACE_WITH_API): only the
 * items whose count differs are saved — each an Adjust movement noted "Stock
 * check" — on one StockCount.
 */
export async function saveStockCount(input: StockCountInput): Promise<StockCountResult> {
  const { clinicFixtures } = await fixtureWorld();
  const { lines } = validateClinicInput(stockCountInputSchema, input);
  const items = new Map(
    clinicFixtures.stockItems.snapshot().map((item) => [item.id, item]),
  );
  const changed = lines.flatMap((line) => {
    const item = items.get(line.itemId);
    return item && item.qtyMilli !== line.countedMilli ? [{ item, line }] : [];
  });
  if (changed.length === 0) return { changed: 0 };
  const count = await clinicFixtures.stockCounts.create({
    lines: changed.map(({ item, line }) => ({
      itemId: item.id,
      systemMilli: item.qtyMilli,
      countedMilli: line.countedMilli,
    })),
    countedAt: new Date().toISOString(),
  });
  for (const { item, line } of changed) {
    await moveStock(clinicFixtures, item, {
      type: 'adjust',
      deltaMilli: line.countedMilli - item.qtyMilli,
      usedFor: 'Stock check',
      stockCountId: count.id,
    });
  }
  return { changed: changed.length };
}
