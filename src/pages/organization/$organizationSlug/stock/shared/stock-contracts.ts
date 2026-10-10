import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import type { operations } from '@/core/http/openapi-types.d.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import type { SortDirection } from '@/lib/routes/search-params.ts';
import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import {
  MEASURE_UNIT_VALUES,
  type MeasureUnit,
  STOCK_CATEGORY_VALUES,
  STOCK_UNIT_VALUES,
  type StockCategory,
  type StockUnit,
  type Tone,
} from '@/shared/api/clinic/clinic-schema.ts';

import { STOCK_MOVEMENT_KINDS, STOCK_PURCHASE_STATUSES } from '../stock.search.ts';
import {
  type StockLevel,
  type StockMovementKind,
  type StockPurchaseStatus,
  toMilli,
} from './stock-units.ts';

/*
 * Clinic stock on clinozy-be (`/app/stock-items`, `/app/stock-item-movements`,
 * `/app/stock-purchases`, `/app/stock-vendors`, `/app/stock-counts`;
 * api-integration §5.6): the wire as the API answers it, and the rows the room
 * reads. Quantities arrive as decimals (`quantity: 4.5`) and the room keeps
 * them ×1000 (`qtyMilli: 4500`) for its previews — converted here and nowhere
 * else; money stays in rupees as the API sends it. What the server derives —
 * an item's level and runway, a purchase's due and status, a vendor's payable,
 * a movement's change and the balance it left — is read, never recomputed.
 */

// ── The wire ──

type ApiStockItem = NonNullable<ApiData<'/app/stock-items/{stock_item_id}', 'get'>>;
type ApiStockItemRow = NonNullable<ApiData<'/app/stock-items', 'get'>>[number];
type ApiStockVendor = NonNullable<ApiData<'/app/stock-vendors/{stock_vendor_id}', 'get'>>;
type ApiStockVendorRow = NonNullable<ApiData<'/app/stock-vendors', 'get'>>[number];
type ApiStockPurchase = NonNullable<
  ApiData<'/app/stock-purchases/{stock_purchase_id}', 'get'>
>;
type ApiStockPurchaseRow = NonNullable<ApiData<'/app/stock-purchases', 'get'>>[number];
type ApiStockMovement = NonNullable<
  ApiData<'/app/stock-items/{stock_item_id}/movements', 'post'>
>;
type ApiStockMovementRow = NonNullable<
  ApiData<'/app/stock-item-movements', 'get'>
>[number];
type ApiStockCount = NonNullable<ApiData<'/app/stock-counts', 'post'>>;
type ApiStockPurchaseListMeta = NonNullable<
  operations['getAppStockPurchases']['responses'][200]['content']['application/json']['meta']
>;
type ApiStockVendorListMeta = NonNullable<
  operations['getAppStockVendors']['responses'][200]['content']['application/json']['meta']
>;

/** A movement's revert reason as the API names it (`revert_reason`). */
const STOCK_REVERT_REASONS = [
  'mistake',
  'wrong_item',
  'wrong_quantity',
  'other',
] as const;

/** One revert reason. */
export type StockRevertReason = (typeof STOCK_REVERT_REASONS)[number];

const itemFieldsWire = {
  id: z.string(),
  stock_item_number: z.number().int(),
  name: z.string(),
  category: z.enum(STOCK_CATEGORY_VALUES),
  unit: z.enum(STOCK_UNIT_VALUES),
  size_per_unit: z.number().nullable(),
  measure_unit: z.enum(MEASURE_UNIT_VALUES).nullable(),
  quantity: z.number(),
  min_quantity: z.number(),
  max_quantity: z.number(),
  usage_per_week: z.number(),
  stock_vendor_id: z.string().nullable(),
  last_rate: z.number().nullable(),
  stock_level: z.enum(['ok', 'low', 'out']),
  lasts_days: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One item (`GET /app/stock-items/:stock_item_id`, and every item write's answer). */
export const stockItemWire = wireSchema<ApiStockItem>()(z.object(itemFieldsWire));

/** An Items list row (`GET /app/stock-items`). */
export const stockItemRowWire = wireSchema<ApiStockItemRow>()(z.object(itemFieldsWire));

const vendorFieldsWire = {
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  is_quick: z.boolean(),
  payable: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One clinic vendor (`GET /app/stock-vendors/:stock_vendor_id`, and every vendor write's answer). */
export const stockVendorWire = wireSchema<ApiStockVendor>()(z.object(vendorFieldsWire));

/** A Vendors list row (`GET /app/stock-vendors`): the vendor and how many live purchases they have. */
export const stockVendorRowWire = wireSchema<ApiStockVendorRow>()(
  z.object({ ...vendorFieldsWire, purchase_count: z.number().int() }),
);

const purchaseFieldsWire = {
  id: z.string(),
  stock_purchase_number: z.number().int(),
  stock_vendor_id: z.string(),
  bill_number: z.string().nullable(),
  purchase_date: z.string(),
  items: z.array(
    z.object({
      line_number: z.number().int(),
      stock_item_id: z.string(),
      quantity: z.number(),
      rate: z.number(),
      amount: z.number(),
    }),
  ),
  bill_amount: z.number(),
  paid_amount: z.number(),
  due_amount: z.number(),
  payment_status: z.enum(STOCK_PURCHASE_STATUSES),
  payment_ids: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One purchase (`GET /app/stock-purchases/:stock_purchase_id`, and every purchase write's answer). */
export const stockPurchaseWire = wireSchema<ApiStockPurchase>()(
  z.object(purchaseFieldsWire),
);

/** A Purchases list row (`GET /app/stock-purchases`). */
export const stockPurchaseRowWire = wireSchema<ApiStockPurchaseRow>()(
  z.object(purchaseFieldsWire),
);

/** The movement types a revert can undo — every type but a revert itself. */
const REVERTIBLE_MOVEMENT_KINDS = STOCK_MOVEMENT_KINDS.filter(
  (kind): kind is Exclude<StockMovementKind, 'reverted'> => kind !== 'reverted',
) as [
  Exclude<StockMovementKind, 'reverted'>,
  ...Exclude<StockMovementKind, 'reverted'>[],
];

const movementFieldsWire = {
  id: z.string(),
  stock_item_id: z.string(),
  type: z.enum(STOCK_MOVEMENT_KINDS),
  quantity_change: z.number(),
  quantity_after: z.number(),
  used_for: z.string().nullable(),
  note: z.string().nullable(),
  patient_treatment_id: z.string().nullable(),
  stock_purchase_id: z.string().nullable(),
  stock_count_id: z.string().nullable(),
  reverts_stock_item_movement_id: z.string().nullable(),
  reverted_by_stock_item_movement_id: z.string().nullable(),
  revert_reason: z.enum(STOCK_REVERT_REASONS).nullable(),
  author_membership_id: z.string().nullable(),
  created_at: z.string(),
};

/** One movement — what a move or a revert answers (`POST …/movements`, `POST …/revert`). */
export const stockMovementWire = wireSchema<ApiStockMovement>()(
  z.object(movementFieldsWire),
);

/**
 * A Movements list row (`GET /app/stock-item-movements`): the movement with its purchase's
 * number and bill number, and a revert's original type and time.
 */
export const stockMovementRowWire = wireSchema<ApiStockMovementRow>()(
  z.object({
    ...movementFieldsWire,
    stock_purchase_number: z.number().int().nullable(),
    bill_number: z.string().nullable(),
    reverts_type: z.enum(REVERTIBLE_MOVEMENT_KINDS).nullable(),
    reverts_created_at: z.string().nullable(),
  }),
);

/** The Purchases list's own `meta`: what is due over its filters (`due_total`), rupees. */
export const stockPurchaseListMetaWire = wireSchema<
  Pick<ApiStockPurchaseListMeta, 'due_total'>
>()(z.object({ due_total: z.number() }));

/** The Vendors list's own `meta`: what is owed to the vendors its filters match (`payable_total`), rupees. */
export const stockVendorListMetaWire = wireSchema<
  Pick<ApiStockVendorListMeta, 'payable_total'>
>()(z.object({ payable_total: z.number() }));

/** A saved Stock check (`POST /app/stock-counts`): how many items it changed. */
export const stockCountWire = wireSchema<ApiStockCount>()(
  z.object({ id: z.string(), changed_item_count: z.number().int() }),
);

// ── The room's shapes ──

/** A vendor as a row names them: the person chip's name and phone. */
export interface StockVendorRef {
  id: string;
  name: string;
  phone: string | null;
}

/** A member as the Movements "By" cell shows them: avatar and short name. */
export interface StockStaffRef {
  /** The membership id (`mem_…`). */
  id: string;
  name: string;
  initials: string;
  tone: Tone;
}

/** A clinic item as clinozy-be keeps it — quantities ×1000, money in rupees. */
export interface StockItemRecord {
  /** `sitm_…`. */
  id: string;
  /** "#167" is this number (`stock_item_number`). */
  seq: number;
  name: string;
  category: StockCategory;
  unit: StockUnit;
  /** The contents of one unit in its measure, ×1000 (a 30 g tube is 30 000); null without. */
  sizePerUnit: number | null;
  measureUnit: MeasureUnit | null;
  /** In stock, ×1000. */
  qtyMilli: number;
  /** The Low stock line, in units. */
  minQty: number;
  /** What a reorder fills up to, in units. */
  maxQty: number;
  usagePerWeekMilli: number;
  vendorId: string | null;
  /** The server's level: Out at 0, Low at or below the minimum, else OK. */
  level: StockLevel;
  /** The server's runway in days at the weekly use; null with no usage. */
  lastsDays: number | null;
  /** The rate of its latest purchase line, rupees; null before one. */
  lastRate: number | null;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** One Items row (`clinic-stock.md:29`): the item and its vendor, from the vendor list. */
export interface StockItemRow extends StockItemRecord {
  vendor: StockVendorRef | null;
}

/** A clinic vendor as clinozy-be keeps them — what is owed to them in rupees. */
export interface StockVendorRecord {
  /** `svnd_…`. */
  id: string;
  name: string;
  /** E.164, or none. */
  phone: string | null;
  /** Added from a picker's "New clinic vendor" (the stacked drawer). */
  isQuick: boolean;
  /** The server's Σ due of their live purchases, rupees. */
  payable: number;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** One Vendors row (Q-K1): the vendor and how many live purchases they have (the server's count). */
export interface StockVendorRow extends StockVendorRecord {
  purchaseCount: number;
}

/** One received line of a purchase, as saved — its lines are fixed once received. */
interface StockPurchaseLine {
  lineNumber: number;
  itemId: string;
  /** Units received, ×1000. */
  qtyMilli: number;
  /** Rupees a unit. */
  rate: number;
  /** The line's amount, rupees (quantity × rate, the server's). */
  amount: number;
}

/** A vendor's bill as clinozy-be keeps it — money in rupees, its status the server's. */
export interface StockPurchaseRecord {
  /** `spur_…`. */
  id: string;
  /** "#16" is this number (`stock_purchase_number`). */
  seq: number;
  vendorId: string;
  /** The vendor's invoice number. */
  billNo: string | null;
  /** The bill's date, `YYYY-MM-DD`. */
  date: string;
  lines: StockPurchaseLine[];
  /** The bill amount, rupees. */
  bill: number;
  /** Paid against it so far, rupees. */
  paid: number;
  /** Bill − paid, rupees (the server's). */
  due: number;
  status: StockPurchaseStatus;
  /** The supplier-bill payments made against it (`pay_…`). */
  paymentIds: string[];
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** One Purchases row (`clinic-stock.md:45`): the bill and its vendor, from the vendor list. */
export interface StockPurchaseRow extends StockPurchaseRecord {
  vendor: StockVendorRef | null;
}

/** A stock change as clinozy-be keeps it: signed, with the balance it left (both ×1000). */
export interface StockMovementRecord {
  /** `smov_…`. */
  id: string;
  itemId: string;
  kind: StockMovementKind;
  /** The signed change, ×1000 (`quantity_change`). */
  deltaMilli: number;
  /** What the item held after it, ×1000 (`quantity_after`) — a toast's "… left". */
  afterMilli: number;
  /** What a use was for ("LHR · Dharti Galani"); only a `used` movement has one. */
  usedFor: string | null;
  /** The remark — a Stock check's adjust carries the server's "Stock check". */
  note: string | null;
  patientTreatmentId: string | null;
  /** The purchase a receipt (or its revert) came with. */
  purchaseId: string | null;
  stockCountId: string | null;
  /** The movement this revert undid. */
  revertsId: string | null;
  /** The revert that undid this movement. */
  revertedById: string | null;
  revertReason: StockRevertReason | null;
  /** Who logged it (`mem_…`). */
  authorId: string | null;
  createdAt: string;
}

/** A movement's item as the Change cell measures it. */
export interface StockMovementItem {
  id: string;
  name: string;
  unit: StockUnit;
  sizePerUnit: number | null;
  measureUnit: MeasureUnit | null;
}

/**
 * A Movements row (`clinic-stock.md:61`): the movement with its item (null once
 * the item is deleted), its author (null for a member who has left), and what
 * it points at — the purchase's number and bill number, a revert's original
 * type and time, as clinozy-be sends them.
 */
export interface StockMovementRow extends StockMovementRecord {
  item: StockMovementItem | null;
  by: StockStaffRef | null;
  /** A later movement reverted this one. */
  reverted: boolean;
  /** A Reverted entry's original — "Reverts used of Today 11:05 · Logged by mistake". */
  reverts: {
    movementId: string;
    /** The original's type (`reverts_type`) — null when the original is gone. */
    kind: StockMovementKind | null;
    /** When the original happened (`reverts_created_at`). */
    at: string | null;
    reason: StockRevertReason | null;
  } | null;
  /** A receipt's purchase — "From purchase" opens it. */
  purchase: {
    id: string;
    /** `stock_purchase_number`. */
    seq: number | null;
    /** `bill_number`. */
    billNo: string | null;
  } | null;
}

/** What a Stock check answers: how many items it changed. */
export interface StockCountResult {
  id: string;
  changed: number;
}

// ── Mappers ──

/** An item from the wire, quantities ×1000. */
export function toStockItemRecord(
  row: z.output<typeof stockItemRowWire>,
): StockItemRecord {
  return {
    id: row.id,
    seq: row.stock_item_number,
    name: row.name,
    category: row.category,
    unit: row.unit,
    sizePerUnit: row.size_per_unit === null ? null : toMilli(row.size_per_unit),
    measureUnit: row.measure_unit,
    qtyMilli: toMilli(row.quantity),
    minQty: row.min_quantity,
    maxQty: row.max_quantity,
    usagePerWeekMilli: toMilli(row.usage_per_week),
    vendorId: row.stock_vendor_id,
    level: row.stock_level,
    lastsDays: row.lasts_days,
    lastRate: row.last_rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A vendor as an item, a purchase or a picker names them. */
export const toStockVendorRef = (
  vendor: Pick<StockVendorRecord, 'id' | 'name' | 'phone'>,
): StockVendorRef => ({ id: vendor.id, name: vendor.name, phone: vendor.phone });

/** A vendor from the wire. */
export function toStockVendorRecord(
  row: z.output<typeof stockVendorWire>,
): StockVendorRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    isQuick: row.is_quick,
    payable: row.payable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A Vendors row from the wire, with the server's purchase count. */
export const toStockVendorRow = (
  row: z.output<typeof stockVendorRowWire>,
): StockVendorRow => ({ ...toStockVendorRecord(row), purchaseCount: row.purchase_count });

/** A purchase from the wire, its lines' quantities ×1000. */
export function toStockPurchaseRecord(
  row: z.output<typeof stockPurchaseRowWire>,
): StockPurchaseRecord {
  return {
    id: row.id,
    seq: row.stock_purchase_number,
    vendorId: row.stock_vendor_id,
    billNo: row.bill_number,
    date: row.purchase_date,
    lines: row.items.map((line) => ({
      lineNumber: line.line_number,
      itemId: line.stock_item_id,
      qtyMilli: toMilli(line.quantity),
      rate: line.rate,
      amount: line.amount,
    })),
    bill: row.bill_amount,
    paid: row.paid_amount,
    due: row.due_amount,
    status: row.payment_status,
    paymentIds: row.payment_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A movement from the wire, its change and balance ×1000. */
export function toStockMovementRecord(
  row: z.output<typeof stockMovementWire>,
): StockMovementRecord {
  return {
    id: row.id,
    itemId: row.stock_item_id,
    kind: row.type,
    deltaMilli: toMilli(row.quantity_change),
    afterMilli: toMilli(row.quantity_after),
    usedFor: row.used_for,
    note: row.note,
    patientTreatmentId: row.patient_treatment_id,
    purchaseId: row.stock_purchase_id,
    stockCountId: row.stock_count_id,
    revertsId: row.reverts_stock_item_movement_id,
    revertedById: row.reverted_by_stock_item_movement_id,
    revertReason: row.revert_reason,
    authorId: row.author_membership_id,
    createdAt: row.created_at,
  };
}

/** A movement's item as its row measures it. */
export const toStockMovementItem = (item: StockItemRecord): StockMovementItem => ({
  id: item.id,
  name: item.name,
  unit: item.unit,
  sizePerUnit: item.sizePerUnit,
  measureUnit: item.measureUnit,
});

/**
 * A Movements row from the wire: the movement with its item and author as the
 * room's lists know them (either null when gone), and what it points at — the
 * purchase's number and bill number, a revert's original type and time.
 */
export function toStockMovementRow(
  row: z.output<typeof stockMovementRowWire>,
  joins: { item: StockMovementItem | null; by: StockStaffRef | null },
): StockMovementRow {
  const movement = toStockMovementRecord(row);
  return {
    ...movement,
    ...joins,
    reverted: movement.revertedById !== null,
    reverts: movement.revertsId
      ? {
          movementId: movement.revertsId,
          kind: row.reverts_type,
          at: row.reverts_created_at,
          reason: movement.revertReason,
        }
      : null,
    purchase: movement.purchaseId
      ? {
          id: movement.purchaseId,
          seq: row.stock_purchase_number,
          billNo: row.bill_number,
        }
      : null,
  };
}

// ── List reads ──

/** The Items columns the API sorts by (`clinic-stock.md:31`). */
type StockItemSortKey = 'seq' | 'name' | 'category' | 'stock' | 'lasts';

/** The Items read's params: search, Low stock, runway, categories, Created, sort. */
export interface StockItemListParams {
  q?: string;
  stock?: 'low';
  /** Items that run out within this many days at their weekly use (`lasts_days_to`, 1–3650). */
  lastsDaysTo?: number;
  category?: readonly StockCategory[];
  created?: CreatedFilter;
  sort?: StockItemSortKey;
  order?: SortDirection;
}

/** The Purchases columns the API sorts by (`clinic-stock.md:47`); none is the bill date, latest first. */
type StockPurchaseSortKey = 'seq' | 'bill' | 'due';

/** The Purchases read's params: search, statuses, one vendor, Created, sort. */
export interface StockPurchaseListParams {
  q?: string;
  status?: readonly StockPurchaseStatus[];
  /** One vendor's (`svnd_…`). */
  vendor?: string;
  created?: CreatedFilter;
  sort?: StockPurchaseSortKey;
  order?: SortDirection;
}

/** The Movements read's params: types, one item, Created — newest first, no search. */
export interface StockMovementListParams {
  type?: readonly StockMovementKind[];
  /** One item's (`sitm_…`). */
  item?: string;
  created?: CreatedFilter;
}

/** The Vendors columns the API sorts by: the name, or what is owed to them. */
type StockVendorSortKey = 'name' | 'payable';

/** The Vendors read's params: search (the name), sort. */
export interface StockVendorListParams {
  q?: string;
  sort?: StockVendorSortKey;
  order?: SortDirection;
}

/**
 * A tab's footer figures: how many rows match (`estimated_total`, null when the
 * API leaves it out) and, on Purchases and Vendors, what is due on them in
 * rupees — null where it cannot be read (Vendors while a search is set).
 */
export interface StockListSummary {
  total: number | null;
  due: number | null;
}
