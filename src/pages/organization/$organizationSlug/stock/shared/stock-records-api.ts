import { api } from '@/core/http/api.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';

import {
  type StockCountResult,
  stockCountWire,
  type StockItemRecord,
  stockItemWire,
  type StockMovementRecord,
  stockMovementWire,
  type StockPurchaseRecord,
  stockPurchaseWire,
  type StockVendorRecord,
  stockVendorWire,
  toStockItemRecord,
  toStockMovementRecord,
  toStockPurchaseRecord,
  toStockVendorRecord,
} from './stock-contracts.ts';
import {
  quickStockItemInput,
  stockCountBodyOf,
  type StockCountInput,
  stockItemChangeOf,
  stockItemCreateBodyOf,
  type StockItemInput,
  stockMovementBodyOf,
  type StockMovementInput,
  type StockPurchaseChange,
  stockPurchaseChangeOf,
  stockPurchaseCreateBodyOf,
  type StockPurchaseInput,
  stockRevertBodyOf,
  type StockRevertInput,
  stockVendorChangeOf,
  stockVendorCreateBodyOf,
  type StockVendorInput,
} from './stock-records-contracts.ts';

/*
 * Clinic stock's writes on clinozy-be (api-integration §5.6). Stock moves only
 * through movements: a use, a receipt, an adjustment, a revert, a purchase's
 * lines and a Stock check each write one, and the server moves the item in the
 * same transaction. An edit sends only what changed, with its read's
 * `updated_at` (`409 record_changed` when someone saved since). A delete takes
 * the reason the member picked and restores as its toast's Undo. Every write
 * carries the action's key; an action of two writes keys them `:a` and `:b`.
 */

/** A write with the user action's idempotency key. */
interface Keyed {
  idempotencyKey: string;
}

/** A delete: the record and the reason confirm's choice. */
export interface StockDeleteRequest {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

// ── Vendors ──

/** Add a clinic vendor (`POST /app/stock-vendors`); a name already taken is a `409 record_already_exists`. */
export async function createStockVendor({
  input,
  idempotencyKey,
}: Keyed & { input: StockVendorInput }): Promise<StockVendorRecord> {
  const response = await api.post('/app/stock-vendors', {
    body: stockVendorCreateBodyOf(input),
    idempotencyKey,
  });
  return toStockVendorRecord(stockVendorWire.parse(response.data));
}

/** Save a clinic vendor — only what changed; nothing changed is no write. */
export async function updateStockVendor({
  record,
  input,
  idempotencyKey,
}: Keyed & {
  record: StockVendorRecord;
  input: StockVendorInput;
}): Promise<StockVendorRecord> {
  const change = stockVendorChangeOf(record, input);
  if (!change) return record;
  const response = await api.patch('/app/stock-vendors/{stock_vendor_id}', {
    params: { stock_vendor_id: record.id },
    body: { ...change, expected_updated_at: record.updatedAt },
    idempotencyKey,
  });
  return toStockVendorRecord(stockVendorWire.parse(response.data));
}

/** Delete a clinic vendor — refused while a purchase still owes them (`409 vendor_has_dues`). */
export async function deleteStockVendor({ id, reason, note }: StockDeleteRequest) {
  await api.delete('/app/stock-vendors/{stock_vendor_id}', {
    params: { stock_vendor_id: id },
    reason,
    note: note ?? undefined,
  });
}

/** Restore a deleted vendor — the Undo of its toast. */
export async function restoreStockVendor(
  id: string,
  idempotencyKey: string,
): Promise<StockVendorRecord> {
  const response = await api.post('/app/stock-vendors/{stock_vendor_id}/restore', {
    params: { stock_vendor_id: id },
    idempotencyKey,
  });
  return toStockVendorRecord(stockVendorWire.parse(response.data));
}

// ── Items ──

/**
 * Add an item (`POST /app/stock-items`): In stock is its opening quantity — an
 * `opening` movement. A name already taken (any case) is a `409 record_already_exists`.
 */
export async function createStockItem({
  input,
  idempotencyKey,
}: Keyed & { input: StockItemInput }): Promise<StockItemRecord> {
  const response = await api.post('/app/stock-items', {
    body: stockItemCreateBodyOf(input),
    idempotencyKey,
  });
  return toStockItemRecord(stockItemWire.parse(response.data));
}

/**
 * Save an item: its changed fields (`PATCH`, with the read's `updated_at`), then
 * — when In stock changed — an Adjust movement to the counted quantity, so the
 * history says who changed the count. Answers with the item as it now stands.
 */
export async function updateStockItem({
  record,
  input,
  idempotencyKey,
}: Keyed & { record: StockItemRecord; input: StockItemInput }): Promise<StockItemRecord> {
  const change = stockItemChangeOf(record, input);
  let saved = record;
  if (change.item) {
    const response = await api.patch('/app/stock-items/{stock_item_id}', {
      params: { stock_item_id: record.id },
      body: { ...change.item, expected_updated_at: record.updatedAt },
      idempotencyKey: `${idempotencyKey}:a`,
    });
    saved = toStockItemRecord(stockItemWire.parse(response.data));
  }
  if (change.counted === null) return saved;
  await api.post('/app/stock-items/{stock_item_id}/movements', {
    params: { stock_item_id: record.id },
    body: { type: 'adjust', quantity: change.counted },
    idempotencyKey: `${idempotencyKey}:b`,
  });
  const response = await api.get('/app/stock-items/{stock_item_id}', {
    params: { stock_item_id: record.id },
  });
  return toStockItemRecord(stockItemWire.parse(response.data));
}

/**
 * "Not in the list · add as typed" and the stacked "New clinic item"
 * (`clinic-stock.md:149, 187–201`): a new item with the design's defaults, from
 * the purchase's vendor.
 */
export function quickCreateStockItem({
  input,
  idempotencyKey,
}: Keyed & {
  input: Parameters<typeof quickStockItemInput>[0];
}): Promise<StockItemRecord> {
  return createStockItem({ input: quickStockItemInput(input), idempotencyKey });
}

/** Delete an item — only one with nothing in stock (`409 item_has_stock`). */
export async function deleteStockItem({ id, reason, note }: StockDeleteRequest) {
  await api.delete('/app/stock-items/{stock_item_id}', {
    params: { stock_item_id: id },
    reason,
    note: note ?? undefined,
  });
}

/** Restore a deleted item — the Undo of its toast. */
export async function restoreStockItem(
  id: string,
  idempotencyKey: string,
): Promise<StockItemRecord> {
  const response = await api.post('/app/stock-items/{stock_item_id}/restore', {
    params: { stock_item_id: id },
    idempotencyKey,
  });
  return toStockItemRecord(stockItemWire.parse(response.data));
}

// ── Movements ──

/**
 * A use, receipt, adjustment, damage or return (`POST
 * /app/stock-items/:id/movements`). Answers with the movement — its
 * `afterMilli` is what is left; below zero is a `409 not_enough_stock`, Adjust
 * to the same count a `400 quantity`.
 */
export async function logStockMovement({
  input,
  idempotencyKey,
}: Keyed & { input: StockMovementInput }): Promise<StockMovementRecord> {
  const response = await api.post('/app/stock-items/{stock_item_id}/movements', {
    params: { stock_item_id: input.itemId },
    body: stockMovementBodyOf(input),
    idempotencyKey,
  });
  return toStockMovementRecord(stockMovementWire.parse(response.data));
}

/**
 * Revert a movement — a `reverted` entry of the opposite change, both kept in
 * the history; also the Undo of a use, a receipt or an adjustment (reason
 * `mistake`). Once per movement (`409 already_reverted`); below zero is a
 * `409 not_enough_stock`.
 */
export async function revertStockMovement({
  input,
  idempotencyKey,
}: Keyed & { input: StockRevertInput }): Promise<StockMovementRecord> {
  const response = await api.post(
    '/app/stock-items/{stock_item_id}/movements/{stock_item_movement_id}/revert',
    {
      params: { stock_item_id: input.itemId, stock_item_movement_id: input.movementId },
      body: stockRevertBodyOf(input),
      idempotencyKey,
    },
  );
  return toStockMovementRecord(stockMovementWire.parse(response.data));
}

// ── Purchases ──

/**
 * Record a purchase (`POST /app/stock-purchases`): each line is a Received
 * movement; "Paid" is a supplier-bill payment (`payment:create`; above the bill,
 * a `409 more_than_due`). Answers with the purchase as its "Paid" left it.
 */
export async function createStockPurchase({
  input,
  idempotencyKey,
}: Keyed & { input: StockPurchaseInput }): Promise<StockPurchaseRecord> {
  const response = await api.post('/app/stock-purchases', {
    body: stockPurchaseCreateBodyOf(input),
    idempotencyKey,
  });
  return toStockPurchaseRecord(stockPurchaseWire.parse(response.data));
}

/**
 * Save a purchase's details — only what changed, never its lines (`409
 * purchase_received`); a bill below what is paid is a `400 bill_amount`.
 */
export async function updateStockPurchase({
  record,
  input,
  idempotencyKey,
}: Keyed & {
  record: StockPurchaseRecord;
  input: StockPurchaseChange;
}): Promise<StockPurchaseRecord> {
  const change = stockPurchaseChangeOf(record, input);
  if (!change) return record;
  const response = await api.patch('/app/stock-purchases/{stock_purchase_id}', {
    params: { stock_purchase_id: record.id },
    body: { ...change, expected_updated_at: record.updatedAt },
    idempotencyKey,
  });
  return toStockPurchaseRecord(stockPurchaseWire.parse(response.data));
}

/**
 * Delete a purchase — only an unpaid one (`409 purchase_paid`); what it received
 * is taken back, so some used since is a `409 not_enough_stock`.
 */
export async function deleteStockPurchase({ id, reason, note }: StockDeleteRequest) {
  await api.delete('/app/stock-purchases/{stock_purchase_id}', {
    params: { stock_purchase_id: id },
    reason,
    note: note ?? undefined,
  });
}

/** Restore a deleted purchase — its stock is received again; the Undo of its toast. */
export async function restoreStockPurchase(
  id: string,
  idempotencyKey: string,
): Promise<StockPurchaseRecord> {
  const response = await api.post('/app/stock-purchases/{stock_purchase_id}/restore', {
    params: { stock_purchase_id: id },
    idempotencyKey,
  });
  return toStockPurchaseRecord(stockPurchaseWire.parse(response.data));
}

// ── Stock check ──

/**
 * Save a Stock check (`POST /app/stock-counts`): each counted item that differs
 * is an Adjust movement noted "Stock check"; nothing differing is a `400 lines`.
 */
export async function saveStockCount({
  input,
  idempotencyKey,
}: Keyed & { input: StockCountInput }): Promise<StockCountResult> {
  const response = await api.post('/app/stock-counts', {
    body: stockCountBodyOf(input),
    idempotencyKey,
  });
  const count = stockCountWire.parse(response.data);
  return { id: count.id, changed: count.changed_item_count };
}
