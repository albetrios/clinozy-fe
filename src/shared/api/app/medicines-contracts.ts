import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import type { CreatedFilter } from './app-list-filters.ts';
import type { Tone } from './app-schema.ts';
import { appToday } from './app-time.ts';
import { expiryDaysLeft } from './medicine-stock.ts';

/*
 * The Medical store's medicines on clinozy-be (`/app/medicines`, api-integration §5.5): the wire
 * as the API answers it, the row every room reads — Medical › Medicines, the medicine drawer and
 * every medicine picker (New sale, the purchase order, the Rx drawer) — and what a client sends.
 * Money is rupees as the API sends it; an expiry month is "MM/YY" on screen and `YYYY-MM` on the
 * wire, converted here and nowhere else. What the server derives — the stock and its level, the
 * nearest expiry, the best rate and the margin, "Needs MRP and composition" — is read, never
 * recomputed.
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

// ── Expiry months ──

/** "MM/YY" — an expiry month as the screens show and take it. */
const SCREEN_EXPIRY = /^(0[1-9]|1[0-2])\/(\d{2})$/;

/** "2027-12" → "12/27" — the API's expiry month as the screens show it. */
export function screenExpiryOf(wire: string): string {
  const match = /^\d{2}(\d{2})-(0[1-9]|1[0-2])$/.exec(wire);
  return match ? `${match[2]}/${match[1]}` : wire;
}

/** "12/27" → "2027-12" — a typed expiry month as the API takes it. */
export function wireExpiryOf(screen: string): string {
  const match = SCREEN_EXPIRY.exec(screen);
  return match ? `20${match[2]}-${match[1]}` : screen;
}

// ── The wire ──

type ApiMedicine = NonNullable<ApiData<'/app/medicines/{medicine_id}', 'get'>>;

/** The six swatches a manufacturer takes (clinozy-be 11.A). */
export const MAKER_TONE_VALUES = [
  'lav',
  'sky',
  'butter',
  'blush',
  'sage',
  'mint',
] as const;

/** A manufacturer as a medicine, a supplier or an MR names it. */
export const makerWire = z.object({
  id: z.string(),
  name: z.string(),
  tone: z.enum(MAKER_TONE_VALUES),
});

/** One medicine as `GET /app/medicines[/:medicine_id]` answers it. */
export const medicineWire = wireSchema<ApiMedicine>()(
  z.object({
    id: z.string(),
    medicine_number: z.number().int(),
    name: z.string(),
    composition: z.string().nullable(),
    manufacturer: makerWire.nullable(),
    is_prescription_only: z.boolean(),
    mrp: z.number(),
    gst_percent: z.union([
      z.literal(0),
      z.literal(5),
      z.literal(12),
      z.literal(18),
      z.literal(28),
    ]),
    price_before_gst: z.number(),
    min_stock: z.number().int(),
    max_stock: z.number().int(),
    quantity: z.number().int(),
    stock_level: z.enum(['ok', 'low', 'out']),
    nearest_expiry: z
      .object({ expiry_month: z.string(), batch_number: z.string() })
      .nullable(),
    near_expiry_discount_percent: z.number().nullable(),
    best_rate: z
      .object({ rate: z.number(), supplier_id: z.string(), supplier_name: z.string() })
      .nullable(),
    margin_percent: z.number().nullable(),
    is_quick: z.boolean(),
    needs_details: z.boolean(),
    batches: z.array(
      z.object({
        id: z.string(),
        batch_number: z.string(),
        expiry_month: z.string(),
        quantity: z.number().int(),
        purchase_rate: z.number().nullable(),
        supplier_id: z.string().nullable(),
        is_expired: z.boolean(),
      }),
    ),
    supplier_prices: z.array(
      z.object({
        supplier_id: z.string(),
        supplier_name: z.string(),
        rate: z.number(),
        free_quantity: z.number().int(),
        lead_days: z.number().int(),
      }),
    ),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

// ── Rows ──

/** A medicine's manufacturer as a row names it: its pill. */
export interface MedicineMaker {
  id: string;
  name: string;
  tone: Tone;
}

/** One batch of a medicine: its number, "MM/YY", whole packs, and what it was bought at. */
interface MedicineBatchRow {
  id: string;
  batchNo: string;
  /** "MM/YY". */
  expiry: string;
  qty: number;
  /** The purchase rate, rupees; null for an opening batch without one. */
  purchaseRate: number | null;
  supplierId: string | null;
  /** Its month has ended. */
  expired: boolean;
}

/** One supplier price: who sells it, at what, the free units and the lead time. */
interface MedicineSupplierPrice {
  supplierId: string;
  supplierName: string;
  /** Rupees. */
  rate: number;
  free: number;
  leadDays: number;
}

/** A stock level as the API reads it: Out at 0, Low at or below the reorder level, else OK. */
type MedicineStockLevel = 'ok' | 'low' | 'out';

/**
 * A medicine as every room reads it (`medical.md:45`): the record, its batches and supplier
 * prices, and what the server derives — the stock and its level, the batch that expires first,
 * the cheapest supplier price and the margin on the MRP. Money in rupees.
 */
export interface MedicineRow {
  id: string;
  /** "#458". */
  seq: number;
  name: string;
  composition: string | null;
  manufacturer: MedicineMaker | null;
  /** "Sold with": prescription only (blush) or over the counter (sage). */
  prescriptionOnly: boolean;
  /** The MRP, GST included (D45), rupees. */
  mrp: number;
  gstPct: number;
  /** The MRP less its GST, rupees. */
  priceBeforeGst: number;
  minStock: number;
  maxStock: number;
  /** Σ batch quantities. */
  stock: number;
  stockLevel: MedicineStockLevel;
  /** The batch in stock that expires first, with its days to the end of its month. */
  nearest: { batchNo: string; expiry: string; daysLeft: number } | null;
  /** The near-expiry discount off the MRP, percent — 0 when none (Q-M3). */
  nearExpiryDiscountPct: number;
  /** The cheapest supplier price, with that supplier's name. */
  bestRate: { supplierId: string; supplierName: string; rate: number } | null;
  /** Margin on the MRP at the best rate, percent; `null` without a rate. */
  margin: number | null;
  /** Added from a picker — "Needs MRP and composition" until a full save. */
  isQuick: boolean;
  needsDetails: boolean;
  batches: MedicineBatchRow[];
  supplierRates: MedicineSupplierPrice[];
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** A medicine as its row, on the clinic's `today` (the nearest batch's days left). */
export function toMedicineRow(
  wire: z.infer<typeof medicineWire>,
  today: string = appToday(),
): MedicineRow {
  const nearestExpiry = wire.nearest_expiry
    ? screenExpiryOf(wire.nearest_expiry.expiry_month)
    : null;
  return {
    id: wire.id,
    seq: wire.medicine_number,
    name: wire.name,
    composition: wire.composition,
    manufacturer: wire.manufacturer,
    prescriptionOnly: wire.is_prescription_only,
    mrp: wire.mrp,
    gstPct: wire.gst_percent,
    priceBeforeGst: wire.price_before_gst,
    minStock: wire.min_stock,
    maxStock: wire.max_stock,
    stock: wire.quantity,
    stockLevel: wire.stock_level,
    nearest:
      wire.nearest_expiry && nearestExpiry
        ? {
            batchNo: wire.nearest_expiry.batch_number,
            expiry: nearestExpiry,
            daysLeft: expiryDaysLeft(nearestExpiry, today),
          }
        : null,
    nearExpiryDiscountPct: wire.near_expiry_discount_percent ?? 0,
    bestRate: wire.best_rate
      ? {
          supplierId: wire.best_rate.supplier_id,
          supplierName: wire.best_rate.supplier_name,
          rate: wire.best_rate.rate,
        }
      : null,
    margin: wire.margin_percent,
    isQuick: wire.is_quick,
    needsDetails: wire.needs_details,
    batches: wire.batches.map((batch) => ({
      id: batch.id,
      batchNo: batch.batch_number,
      expiry: screenExpiryOf(batch.expiry_month),
      qty: batch.quantity,
      purchaseRate: batch.purchase_rate,
      supplierId: batch.supplier_id,
      expired: batch.is_expired,
    })),
    supplierRates: wire.supplier_prices.map((price) => ({
      supplierId: price.supplier_id,
      supplierName: price.supplier_name,
      rate: price.rate,
      free: price.free_quantity,
      leadDays: price.lead_days,
    })),
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

// ── Writes ──

/** "Add a name" (`medical.md:174`). */
const MEDICINE_NAME_MESSAGE = 'Add a name';
/** "Enter the MRP" (`medical.md:178`). */
const MEDICINE_MRP_MESSAGE = 'Enter the MRP';
/** "Enter a rate for every supplier price" (`medical.md:182`). */
const MEDICINE_RATE_MESSAGE = 'Enter a rate for every supplier price';

/** The GST rates a medicine takes (clinozy-be 11.D). */
const MEDICINE_GST_VALUES = [0, 5, 12, 18, 28] as const;

/** One GST rate. */
export type MedicineGst = (typeof MEDICINE_GST_VALUES)[number];

/** A batch as the drawer sends it: its id when saved, "MM/YY", whole packs, the rate in rupees. */
const medicineBatchInputSchema = z.object({
  id: z.string().optional(),
  batchNo: z.string().trim().min(1, 'Enter the batch').max(20),
  expiry: z.string().regex(SCREEN_EXPIRY, 'Enter the expiry'),
  qty: z.number().int().nonnegative().max(9999),
  purchaseRate: z.number().nonnegative().nullable(),
  supplierId: z.string().nullable(),
});

/** A supplier price as the drawer sends it — a picked supplier needs its rate. */
const supplierRateInputSchema = z.object({
  supplierId: z.string(),
  rate: z.number().refine((rate) => rate > 0, MEDICINE_RATE_MESSAGE),
  free: z.number().int().nonnegative(),
  leadDays: z.number().int().nonnegative(),
});

/**
 * Every field a client sends for a medicine: the reorder level never above the fill-up level, at
 * most 9,999 (H:2916). The API checks everything again.
 */
export const medicineInputSchema = z
  .object({
    name: z.string().trim().min(1, MEDICINE_NAME_MESSAGE).max(120),
    composition: z.string().trim().max(160).nullable(),
    manufacturerId: z.string(),
    prescriptionOnly: z.boolean(),
    mrp: z.number().refine((mrp) => mrp > 0, MEDICINE_MRP_MESSAGE),
    gstPct: z.union(MEDICINE_GST_VALUES.map((value) => z.literal(value))),
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

/** What a medicine save sends — rupees, "MM/YY". */
export type MedicineInput = z.infer<typeof medicineInputSchema>;

/** The record's fields in the API's words. */
function medicineFieldsOf(input: MedicineInput) {
  return {
    name: input.name,
    composition: input.composition,
    manufacturer_id: input.manufacturerId,
    is_prescription_only: input.prescriptionOnly,
    mrp: input.mrp,
    gst_percent: input.gstPct,
    min_stock: input.minStock,
    max_stock: input.maxStock,
    batches: input.batches.map((batch) => ({
      ...(batch.id ? { id: batch.id } : {}),
      batch_number: batch.batchNo,
      expiry_month: wireExpiryOf(batch.expiry),
      quantity: batch.qty,
      ...(batch.purchaseRate === null ? {} : { purchase_rate: batch.purchaseRate }),
      ...(batch.supplierId === null ? {} : { supplier_id: batch.supplierId }),
    })),
    supplier_prices: input.supplierRates.map((rate) => ({
      supplier_id: rate.supplierId,
      rate: rate.rate,
      free_quantity: rate.free,
      lead_days: rate.leadDays,
    })),
  } satisfies ApiBody<'/app/medicines/{medicine_id}', 'patch'>;
}

/** A new medicine as `POST /app/medicines` takes it — a full record, never a quick one. */
export function medicineCreateBodyOf(
  input: MedicineInput,
): ApiBody<'/app/medicines', 'post'> {
  return { ...medicineFieldsOf(input), is_quick: false };
}

/**
 * A medicine edit as `PATCH /app/medicines/:id` takes it: the fields that changed — the batch and
 * supplier lists whole when either changed (the API replaces each list, keeping a batch by its id)
 * — with the read's `updated_at`; null when nothing changed. A full save clears "Needs MRP and
 * composition" on the server.
 */
export function medicineChangeOf(
  record: MedicineRow,
  input: MedicineInput,
): ApiBody<'/app/medicines/{medicine_id}', 'patch'> | null {
  const next = medicineFieldsOf(input);
  const saved = medicineFieldsOf({
    name: record.name,
    composition: record.composition,
    manufacturerId: record.manufacturer?.id ?? '',
    prescriptionOnly: record.prescriptionOnly,
    mrp: record.mrp,
    gstPct: record.gstPct as MedicineGst,
    minStock: record.minStock,
    maxStock: record.maxStock,
    batches: record.batches,
    supplierRates: record.supplierRates,
  });
  const change: ApiBody<'/app/medicines/{medicine_id}', 'patch'> = {};
  const keys = Object.keys(next) as (keyof typeof next)[];
  for (const key of keys) {
    if (JSON.stringify(next[key]) !== JSON.stringify(saved[key])) {
      Object.assign(change, { [key]: next[key] });
    }
  }
  if (record.isQuick && Object.keys(change).length === 0) {
    // A quick record saved as it is still becomes a full one.
    change.name = next.name;
  }
  if (Object.keys(change).length === 0) return null;
  return { ...change, expected_updated_at: record.updatedAt };
}

/**
 * A quick medicine from a picker's create row (`quickCreateMedicine`): the typed name — MRP ₹0 and
 * "Needs MRP and composition" on the server — under a manufacturer when one is known. A supplier
 * price needs its rate, so none is sent: the purchase order prices its line.
 */
export interface QuickMedicineInput {
  name: string;
  manufacturerId?: string | null;
}

/** A quick medicine as `POST /app/medicines` takes it. */
export function quickMedicineBodyOf(
  input: QuickMedicineInput,
): ApiBody<'/app/medicines', 'post'> {
  return {
    name: input.name.trim(),
    is_quick: true,
    ...(input.manufacturerId ? { manufacturer_id: input.manufacturerId } : {}),
  };
}

// ── Reads ──

/** The Medicines columns the server sorts by (`medical.md:47`). */
export type MedicineSortKey =
  'seq' | 'name' | 'manufacturer' | 'stock' | 'mrp' | 'margin';

/** One near-expiry window of the "Nearest expiry" filter, in days. */
type MedicineExpiryWindow = '30' | '60' | '90';

/**
 * `listMedicines`' params: name, composition, manufacturer or "#458"; "Low stock" (at or below the
 * reorder level); a batch in stock expiring within 30 / 60 / 90 days; any of these manufacturers;
 * Created; the sort.
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
