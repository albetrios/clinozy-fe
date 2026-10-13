import { z } from 'zod';

import type { CreatedFilter } from './app-list-filters.ts';
import {
  medicineBatchSchema,
  medicineSchema,
  paiseSchema,
  supplierRateSchema,
  type Tone,
} from './app-schema.ts';

/*
 * The Medical store's medicines beyond the generated contract (KICKOFF §6.7
 * Data, D22): the plan-only fields the screens show — each a fixture field
 * until clinozy-be serves it (Appendix F, REPLACE_WITH_API) — what a list row
 * derives, what a client sends, and the list read's params. Read by Medical ›
 * Medicines and the medicine drawer, and by every medicine picker (New sale,
 * the purchase order, the Rx drawer).
 */

// ── Form ──

/** A medicine's Browse group (H:5058): applied on the skin, or taken. */
export type MedicineForm = 'oral' | 'topical';

const TOPICAL = /lotion|shampoo|cream|gel|serum|sunscreen|spf|wash|soap|oil/i;

/**
 * Topical when the name says it is put on (H:5058), oral otherwise — the
 * group the invoice's and the Rx drawer's Browse files a medicine under.
 */
export function medicineForm(name: string): MedicineForm {
  return TOPICAL.test(name) ? 'topical' : 'oral';
}

// ── Records ──

/**
 * A medicine as the rooms read it: the contract's `Medicine` (`S:795–814`)
 * plus the plan's "Sold with" and near-expiry discount (Appendix F).
 */
export const medicineRecordSchema = medicineSchema.extend({
  /** "Sold with": prescription only (blush) or over the counter (sage, default). */
  prescriptionOnly: z.boolean(),
  /** The near-expiry discount off the MRP, percent — 0, or 20 while "Sell at 20% off" is on (Q-M3). */
  nearExpiryDiscountPct: z.number().int().min(0).max(100),
});

/** A medicine record — the contract's fields and the plan's. */
export type MedicineRecord = z.infer<typeof medicineRecordSchema>;

/** A medicine's manufacturer as a row names it: its pill. */
export interface MedicineMaker {
  id: string;
  name: string;
  tone: Tone;
}

/**
 * One Medicines row: the record and what the server derives for the list
 * (`medical.md:45`) — the stock, the manufacturer, the batch that expires
 * first, the cheapest supplier price and the margin on the MRP.
 */
export interface MedicineRow extends MedicineRecord {
  /** Σ batch quantities. */
  stock: number;
  manufacturer: MedicineMaker | null;
  /** The batch in stock that expires first, with its days to the end of its month. */
  nearest: { batchNo: string; expiry: string; daysLeft: number } | null;
  /** The cheapest supplier price, with that supplier's name. */
  bestRate: { supplierId: string; supplierName: string; rate: number } | null;
  /** Margin on the MRP at the best rate, a whole percent; `null` without a rate. */
  margin: number | null;
}

// ── Writes ──

/** "Add a name" (`medical.md:174`). */
const MEDICINE_NAME_MESSAGE = 'Add a name';
/** "Enter the MRP" (`medical.md:178`). */
const MEDICINE_MRP_MESSAGE = 'Enter the MRP';
/** "Enter a rate for every supplier price" (`medical.md:182`). */
const MEDICINE_RATE_MESSAGE = 'Enter a rate for every supplier price';

/** A batch as the drawer sends it: "MM/YY", whole packs, the purchase rate in paise. */
const medicineBatchInputSchema = medicineBatchSchema.extend({
  batchNo: z.string().trim().min(1, 'Enter the batch').max(40),
});

/** A supplier price as the drawer sends it — a picked supplier needs its rate. */
const supplierRateInputSchema = supplierRateSchema.extend({
  rate: paiseSchema.refine((rate) => rate > 0, MEDICINE_RATE_MESSAGE),
});

/**
 * Every field a client sends for a medicine (`S:795–814`; the plan's two):
 * the reorder level never above the fill-up level, at most 9,999 (H:2916).
 */
export const medicineInputSchema = z
  .object({
    name: z.string().trim().min(1, MEDICINE_NAME_MESSAGE).max(120),
    composition: z.string().trim().max(200).nullable(),
    manufacturerId: z.uuid(),
    prescriptionOnly: z.boolean(),
    mrp: paiseSchema.refine((mrp) => mrp > 0, MEDICINE_MRP_MESSAGE),
    gstPct: z.number().int().min(0).max(28),
    minStock: z.number().int().min(0).max(9999),
    maxStock: z.number().int().min(0).max(9999),
    batches: z.array(medicineBatchInputSchema).max(50),
    supplierRates: z.array(supplierRateInputSchema).max(20),
  })
  .superRefine((input, ctx) => {
    if (input.minStock > input.maxStock) {
      ctx.addIssue({
        code: 'custom',
        path: ['minStock'],
        message: 'Reorder at can’t be above Fill up to',
      });
    }
  });

/** What a medicine save sends. */
export type MedicineInput = z.infer<typeof medicineInputSchema>;

/**
 * A quick medicine from a picker's create row (`quickCreateMedicine`,
 * `S:1670`): the typed name, MRP ₹0, flagged "Needs MRP and composition" —
 * linked to the order's supplier when it comes from a purchase order.
 */
export interface QuickMedicineInput {
  name: string;
  manufacturerId?: string | null;
  supplierId?: string | null;
}

// ── Reads ──

/** The Medicines columns the server sorts by (`medical.md:47`). */
export type MedicineSortKey =
  'seq' | 'name' | 'manufacturer' | 'stock' | 'mrp' | 'margin';

/** One near-expiry window of the "Nearest expiry" filter, in days. */
type MedicineExpiryWindow = '30' | '60' | '90';

/**
 * `listMedicines`' params (`S:53`): name, composition, manufacturer or "#458";
 * "Low stock" (at or below the reorder level); a batch in stock expiring
 * within 30 / 60 / 90 days; any of these manufacturers; Created; the sort.
 */
export interface MedicineListParams {
  q?: string;
  stock?: 'low';
  expiry?: MedicineExpiryWindow;
  manufacturer?: readonly string[];
  created?: CreatedFilter;
  sort?: MedicineSortKey;
  order?: 'asc' | 'desc';
}
