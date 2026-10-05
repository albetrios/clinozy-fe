import { z } from 'zod';

import {
  civilDateSchema,
  measureUnitSchema,
  paiseSchema,
  phoneSchema,
  type RevertReason,
  stockCategorySchema,
  type StockItem,
  type StockMovement,
  stockUnitSchema,
} from '@/shared/api/clinic/clinic-schema.ts';

/*
 * What a client sends for Clinic stock's records (KICKOFF §6.8 Drawers;
 * `S:860–937`, `S:1685–1693`): vendors, items, purchases, movements and a
 * stock check. The drawers hold their own form values; these are the writes'
 * contracts, checked again by the fixture server until clinozy-be answers
 * (REPLACE_WITH_API). Quantities travel ×1000 (`S:886`), money in paise.
 */

/** "Add a name" — a vendor's and an item's one required field (`clinic-stock.md:109, 178`). */
export const STOCK_NAME_MESSAGE = 'Add a name';

/** "Pick a supplier" — a purchase's required vendor (`clinic-stock.md:146`). */
const STOCK_VENDOR_MESSAGE = 'Pick a supplier';

/** The longest name a vendor or an item takes. */
export const STOCK_NAME_MAX = 120;

const nameSchema = z.string().trim().min(1, STOCK_NAME_MESSAGE).max(STOCK_NAME_MAX);

/** New / Edit clinic vendor: Name* · Phone (`clinic-stock.md:174–185`, `S:1693`). */
export const stockVendorInputSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.nullable(),
});

/** What a vendor save sends. */
export type StockVendorInput = z.infer<typeof stockVendorInputSchema>;

/**
 * New / Edit item (`clinic-stock.md:105–124`, `S:873–892`): what the item is,
 * its levels and its vendor. Contents and their measure come together.
 */
export const stockItemInputSchema = z.object({
  name: nameSchema,
  category: stockCategorySchema,
  unit: stockUnitSchema,
  sizePerUnit: z.number().int().positive().nullable(),
  measureUnit: measureUnitSchema.nullable(),
  minQty: z.number().int().nonnegative(),
  maxQty: z.number().int().nonnegative(),
  usagePerWeekMilli: z.number().int().nonnegative(),
  vendorId: z.uuid().nullable(),
});

/** What an item save sends; `qtyMilli` is the In stock field (the opening quantity on create). */
export type StockItemInput = z.infer<typeof stockItemInputSchema> & {
  qtyMilli: number;
};

/** The movements a hand-entered movement can be (`clinic-stock.md:130`); Reverted is the server's. */
export const STOCK_MOVEMENT_INPUT_TYPES = [
  'used',
  'received',
  'adjust',
  'damaged',
  'returned',
] as const;

/** One hand-entered movement type. */
export type StockMovementInputType = (typeof STOCK_MOVEMENT_INPUT_TYPES)[number];

/**
 * Log usage / Receive stock / Adjust stock and the Use popover (`useStock`,
 * `S:1688`): the quantity in units ×1000 — for Adjust the counted quantity —
 * what it was used for, and a remark (a backend request, C27).
 */
export const stockMovementInputSchema = z.object({
  itemId: z.uuid(),
  type: z.enum(STOCK_MOVEMENT_INPUT_TYPES),
  quantityMilli: z.number().int().nonnegative(),
  usedFor: z.string().trim().max(80).nullable(),
  note: z.string().trim().max(280).nullable(),
});

/** What a movement save sends. */
export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;

/** One received line of a purchase: the item, how many ×1000 and the rate. */
const purchaseLineSchema = z.object({
  itemId: z.uuid(),
  qtyMilli: z.number().int().positive(),
  rate: paiseSchema,
});

/**
 * New / Edit purchase (`clinic-stock.md:142–157`, `S:894–907`): the vendor's
 * bill, what it brought in and what was paid on it.
 */
export const stockPurchaseInputSchema = z.object({
  vendorId: z.uuid(STOCK_VENDOR_MESSAGE),
  billNo: z.string().trim().max(40).nullable(),
  date: civilDateSchema,
  lines: z.array(purchaseLineSchema).max(100),
  bill: paiseSchema,
  paid: paiseSchema,
});

/** What a purchase save sends. */
export type StockPurchaseInput = z.infer<typeof stockPurchaseInputSchema>;

/** A Stock check's counts (`saveStockCount`, `S:1690`; ≤ 500 lines). */
export const stockCountInputSchema = z.object({
  lines: z
    .array(z.object({ itemId: z.uuid(), countedMilli: z.number().int().nonnegative() }))
    .max(500),
});

/** What a Stock check save sends. */
export type StockCountInput = z.infer<typeof stockCountInputSchema>;

/** What a movement write answers: the movement and the item as it now stands. */
export interface StockMovementResult {
  movement: StockMovement;
  item: StockItem;
}

/** What a Stock check answers: how many items changed. */
export interface StockCountResult {
  changed: number;
}

/** A revert: the movement, the confirm's reason and its note (`revertMovement`, `S:1689`). */
export interface StockRevertInput {
  movementId: string;
  reason: RevertReason;
  note: string | null;
}
