import type { ApiBody } from '@/core/http/api.ts';
import type {
  MeasureUnit,
  StockCategory,
  StockUnit,
} from '@/shared/api/clinic/clinic-schema.ts';

import type {
  StockItemRecord,
  StockPurchaseRecord,
  StockRevertReason,
  StockVendorRecord,
} from './stock-contracts.ts';
import { fromMilli } from './stock-units.ts';

/*
 * What Clinic stock writes to clinozy-be (api-integration §5.6): vendors, items,
 * movements, purchases and a Stock check. The drawers hold their own form
 * values and hand these over — quantities ×1000, money in rupees — and the
 * builders here turn them into the API's bodies: decimals for quantities, only
 * what changed on an edit. The API checks everything again.
 */

/** The longest name a vendor or an item takes. */
export const STOCK_NAME_MAX = 120;

// ── Vendors ──

/** New / Edit clinic vendor: Name* · Phone (`clinic-stock.md:174–185`). */
export interface StockVendorInput {
  name: string;
  /** E.164, or none. */
  phone: string | null;
  /** Added from a picker's stacked "New clinic vendor" — set on create only. */
  isQuick?: boolean;
}

/** A new vendor as `POST /app/stock-vendors` takes it. */
export const stockVendorCreateBodyOf = (
  input: StockVendorInput,
): ApiBody<'/app/stock-vendors', 'post'> => ({
  name: input.name,
  phone: input.phone,
  is_quick: input.isQuick ?? false,
});

/** A vendor edit as `PATCH /app/stock-vendors/:id` takes it — only what changed; null when nothing did. */
export function stockVendorChangeOf(
  record: StockVendorRecord,
  input: StockVendorInput,
): ApiBody<'/app/stock-vendors/{stock_vendor_id}', 'patch'> | null {
  const change: ApiBody<'/app/stock-vendors/{stock_vendor_id}', 'patch'> = {};
  if (input.name !== record.name) change.name = input.name;
  if (input.phone !== record.phone) change.phone = input.phone;
  return Object.keys(change).length > 0 ? change : null;
}

// ── Items ──

/**
 * New / Edit item (`clinic-stock.md:105–124`): what the item is, its levels and
 * its vendor. Contents and their measure come together.
 */
export interface StockItemInput {
  name: string;
  category: StockCategory;
  unit: StockUnit;
  /** The contents of one unit in its measure, ×1000; null without. */
  sizePerUnit: number | null;
  measureUnit: MeasureUnit | null;
  minQty: number;
  maxQty: number;
  usagePerWeekMilli: number;
  vendorId: string | null;
  /**
   * In stock, ×1000: the opening quantity on create; on an edit a changed count
   * is an Adjust movement, never written to the item.
   */
  qtyMilli: number;
}

/** The item's own fields in the API's words — contents and measure together, or neither. */
function itemFieldsOf(input: StockItemInput) {
  const contents = input.sizePerUnit === null ? null : fromMilli(input.sizePerUnit);
  return {
    name: input.name,
    category: input.category,
    unit: input.unit,
    size_per_unit: contents,
    measure_unit: contents === null ? null : input.measureUnit,
    min_quantity: input.minQty,
    max_quantity: input.maxQty,
    usage_per_week: fromMilli(input.usagePerWeekMilli),
    stock_vendor_id: input.vendorId,
  } satisfies ApiBody<'/app/stock-items/{stock_item_id}', 'patch'>;
}

/** A new item as `POST /app/stock-items` takes it — In stock its `opening_quantity`. */
export function stockItemCreateBodyOf(
  input: StockItemInput,
): ApiBody<'/app/stock-items', 'post'> {
  return {
    ...itemFieldsOf(input),
    opening_quantity: input.qtyMilli > 0 ? fromMilli(input.qtyMilli) : undefined,
  };
}

/**
 * An item edit as its two writes: the item's changed fields (`PATCH
 * /app/stock-items/:id`, null when none changed — never the quantity) and the
 * counted quantity for an Adjust movement (null when In stock did not change).
 */
export function stockItemChangeOf(
  record: StockItemRecord,
  input: StockItemInput,
): {
  item: ApiBody<'/app/stock-items/{stock_item_id}', 'patch'> | null;
  counted: number | null;
} {
  const next = itemFieldsOf(input);
  const saved = itemFieldsOf(record);
  const item: ApiBody<'/app/stock-items/{stock_item_id}', 'patch'> = {};
  if (next.name !== saved.name) item.name = next.name;
  if (next.category !== saved.category) item.category = next.category;
  if (next.unit !== saved.unit) item.unit = next.unit;
  if (
    next.size_per_unit !== saved.size_per_unit ||
    next.measure_unit !== saved.measure_unit
  ) {
    item.size_per_unit = next.size_per_unit;
    item.measure_unit = next.measure_unit;
  }
  if (next.min_quantity !== saved.min_quantity) item.min_quantity = next.min_quantity;
  if (next.max_quantity !== saved.max_quantity) item.max_quantity = next.max_quantity;
  if (next.usage_per_week !== saved.usage_per_week) {
    item.usage_per_week = next.usage_per_week;
  }
  if (next.stock_vendor_id !== saved.stock_vendor_id) {
    item.stock_vendor_id = next.stock_vendor_id;
  }
  return {
    item: Object.keys(item).length > 0 ? item : null,
    counted: input.qtyMilli === record.qtyMilli ? null : fromMilli(input.qtyMilli),
  };
}

/**
 * "Not in the list · add as typed" / the stacked "New clinic item"
 * (`clinic-stock.md:149, 187–201`): the design's defaults, sent explicitly — a
 * piece, Creams & Serums, minimum 1, maximum 5 — from the purchase's vendor,
 * unless the stacked drawer said otherwise.
 */
export function quickStockItemInput(
  input: Partial<Omit<StockItemInput, 'name'>> & { name: string },
): StockItemInput {
  return {
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
  };
}

// ── Movements ──

/** Typed text without its outer spaces, or null when nothing is left. */
function textOrNull(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** The movements a member logs (`clinic-stock.md:130`); Opening and Reverted are the server's. */
export const STOCK_MOVEMENT_INPUT_TYPES = [
  'used',
  'received',
  'adjust',
  'damaged',
  'returned',
] as const;

/** One movement a member logs. */
export type StockMovementInputType = (typeof STOCK_MOVEMENT_INPUT_TYPES)[number];

/**
 * Log usage / Receive stock / Adjust stock and the Use popover: the quantity in
 * units ×1000 — for Adjust the counted quantity — what a use was for, and a
 * remark.
 */
export interface StockMovementInput {
  itemId: string;
  type: StockMovementInputType;
  quantityMilli: number;
  /** What a use was for — only a `used` movement takes one. */
  usedFor: string | null;
  note: string | null;
}

/**
 * A movement as `POST /app/stock-items/:id/movements` takes it: `used_for` on a
 * use alone — any other type keeps that text in its remark, so nothing typed is
 * lost.
 */
export function stockMovementBodyOf(
  input: StockMovementInput,
): ApiBody<'/app/stock-items/{stock_item_id}/movements', 'post'> {
  const usedFor = textOrNull(input.usedFor);
  const note = textOrNull(input.note);
  const quantity = fromMilli(input.quantityMilli);
  if (input.type === 'used') {
    return {
      type: input.type,
      quantity,
      used_for: usedFor ?? undefined,
      note: note ?? undefined,
    };
  }
  const remark = [usedFor, note].filter(Boolean).join(' · ');
  return { type: input.type, quantity, note: remark === '' ? undefined : remark };
}

/** A revert: the movement (and its item), the confirm's reason and its note. */
export interface StockRevertInput {
  itemId: string;
  movementId: string;
  reason: StockRevertReason;
  /** Required for `other`. */
  note: string | null;
}

/** A revert as `POST …/movements/:id/revert` takes it — a blank note is none. */
export const stockRevertBodyOf = (
  input: StockRevertInput,
): ApiBody<
  '/app/stock-items/{stock_item_id}/movements/{stock_item_movement_id}/revert',
  'post'
> => ({ reason: input.reason, note: textOrNull(input.note) ?? undefined });

// ── Purchases ──

/** A way a purchase's "Paid" is paid (`splits[].mode`). */
type StockPaymentMode = 'cash' | 'upi' | 'card';

/** What a new purchase's "Paid" records: the paying branch, the mode and the amount in rupees. */
interface StockPurchasePayment {
  branchId: string;
  mode: StockPaymentMode;
  amount: number;
}

/** One line a new purchase receives: the item, how many ×1000 and the rate in rupees. */
interface StockPurchaseLineInput {
  itemId: string;
  qtyMilli: number;
  rate: number;
}

/**
 * New purchase (`clinic-stock.md:142–157`): the vendor's bill, what it brought
 * in and — with `payment:create` — what was paid on it.
 */
export interface StockPurchaseInput {
  vendorId: string;
  billNo: string | null;
  /** The bill's date, `YYYY-MM-DD` (never in the future). */
  date: string;
  lines: StockPurchaseLineInput[];
  /** The bill amount in rupees; null for the lines' total. */
  bill: number | null;
  /** "Paid" at create, recorded as a supplier-bill payment; null for none. */
  payment: StockPurchasePayment | null;
}

/** A new purchase as `POST /app/stock-purchases` takes it. */
export function stockPurchaseCreateBodyOf(
  input: StockPurchaseInput,
): ApiBody<'/app/stock-purchases', 'post'> {
  return {
    stock_vendor_id: input.vendorId,
    bill_number: input.billNo,
    purchase_date: input.date,
    items: input.lines.map((line) => ({
      stock_item_id: line.itemId,
      quantity: fromMilli(line.qtyMilli),
      rate: line.rate,
    })),
    bill_amount: input.bill ?? undefined,
    payment: input.payment
      ? {
          branch_id: input.payment.branchId,
          splits: [{ mode: input.payment.mode, amount: input.payment.amount }],
        }
      : undefined,
  };
}

/** Edit purchase: the bill's details — its lines are fixed once received. */
export interface StockPurchaseChange {
  vendorId: string;
  billNo: string | null;
  date: string;
  /** Rupees — never below what is paid. */
  bill: number;
}

/** A purchase edit as `PATCH /app/stock-purchases/:id` takes it — only what changed; null when nothing did. */
export function stockPurchaseChangeOf(
  record: StockPurchaseRecord,
  input: StockPurchaseChange,
): ApiBody<'/app/stock-purchases/{stock_purchase_id}', 'patch'> | null {
  const change: ApiBody<'/app/stock-purchases/{stock_purchase_id}', 'patch'> = {};
  if (input.vendorId !== record.vendorId) change.stock_vendor_id = input.vendorId;
  if (input.billNo !== record.billNo) change.bill_number = input.billNo;
  if (input.date !== record.date) change.purchase_date = input.date;
  if (input.bill !== record.bill) change.bill_amount = input.bill;
  return Object.keys(change).length > 0 ? change : null;
}

// ── Stock check ──

/** A Stock check's counts — only the items whose count differs (≤ 500 lines, each once). */
export interface StockCountInput {
  lines: { itemId: string; countedMilli: number }[];
}

/** A Stock check as `POST /app/stock-counts` takes it. */
export const stockCountBodyOf = (
  input: StockCountInput,
): ApiBody<'/app/stock-counts', 'post'> => ({
  lines: input.lines.map((line) => ({
    stock_item_id: line.itemId,
    counted_quantity: fromMilli(line.countedMilli),
  })),
});
