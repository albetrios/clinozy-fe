import type { ApiBody } from '@/core/http/api.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { wireExpiryOf } from '@/shared/api/app/medicines-contracts.ts';
import type { MoneySplit } from '@/shared/api/app/payments-contracts.ts';

import type {
  ManufacturerRow,
  MrRow,
  PurchaseOrderRow,
  RefundMode,
  SaleReturnReason,
  SupplierRow,
} from './medical-contracts.ts';

/*
 * What the Medical store writes to clinozy-be (api-integration §5.5): suppliers, manufacturers,
 * MRs and their visits, purchase orders and their receipt, sales and their returns, a supplier
 * credit. The drawers hold their own form values — money in rupees, an expiry
 * month "MM/YY" — and hand these over; the builders here turn them into the API's bodies: only
 * what changed on an edit, with the read's `updated_at`. The API checks everything again.
 */

/** The six colours a manufacturer takes, in the swatch row's order (`medical.md:213`). */
export const MANUFACTURER_TONES: readonly Tone[] = [
  'lav',
  'sky',
  'butter',
  'blush',
  'sage',
  'mint',
];

/** Two ids in a stable order (public ids are lowercase ASCII). */
const compareIds = (a: string, b: string) => Number(a > b) - Number(a < b);

/** A list as a change compares it: the same ids, in any order. */
const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  [...a].sort(compareIds).join(',') === [...b].sort(compareIds).join(',');

/** Text as the API takes it — none when blank. */
const textOrNull = (text: string | null) => (text?.trim() ? text.trim() : null);

// ── Suppliers ──

/** Supplier: Agency name* · Phone · GST number · the makers it distributes (`medical.md:190–200`). */
export interface SupplierInput {
  name: string;
  /** E.164, or none. */
  phone: string | null;
  gstNumber: string | null;
  manufacturerIds: string[];
  /** Added from a picker's stacked "New supplier" — set on create only. */
  isQuick?: boolean;
}

/** A new supplier as `POST /app/suppliers` takes it. */
export const supplierCreateBodyOf = (
  input: SupplierInput,
): ApiBody<'/app/suppliers', 'post'> => ({
  name: input.name.trim(),
  phone: input.phone,
  gst_number: textOrNull(input.gstNumber),
  manufacturer_ids: input.manufacturerIds,
  is_quick: input.isQuick ?? false,
});

/** A supplier edit as `PATCH /app/suppliers/:id` takes it — only what changed; null when nothing did. */
export function supplierChangeOf(
  record: SupplierRow,
  input: SupplierInput,
): ApiBody<'/app/suppliers/{supplier_id}', 'patch'> | null {
  const change: ApiBody<'/app/suppliers/{supplier_id}', 'patch'> = {};
  if (input.name.trim() !== record.name) change.name = input.name.trim();
  if (input.phone !== record.phone) change.phone = input.phone;
  if (textOrNull(input.gstNumber) !== record.gstNumber) {
    change.gst_number = textOrNull(input.gstNumber);
  }
  if (!sameIds(input.manufacturerIds, record.manufacturerIds)) {
    change.manufacturer_ids = input.manufacturerIds;
  }
  if (Object.keys(change).length === 0) return null;
  return { ...change, expected_updated_at: record.updatedAt };
}

// ── Manufacturers ──

/**
 * Manufacturer: Name* (upper case, as the pack prints it) · Colour · who distributes and
 * represents it (`medical.md:208–216`). The links live on the suppliers and MRs; the server writes
 * them there.
 */
export interface ManufacturerInput {
  name: string;
  tone: Tone;
  supplierIds: string[];
  mrIds: string[];
  isQuick?: boolean;
}

/** The six swatches the API takes. */
type MakerTone = 'lav' | 'sky' | 'butter' | 'blush' | 'sage' | 'mint';

/** A tone as the API takes it — any other is the first swatch. */
const makerTone = (tone: Tone): MakerTone =>
  (MANUFACTURER_TONES.includes(tone) ? tone : 'lav') as MakerTone;

/** A new manufacturer as `POST /app/manufacturers` takes it — its name upper case. */
export const manufacturerCreateBodyOf = (
  input: ManufacturerInput,
): ApiBody<'/app/manufacturers', 'post'> => ({
  name: input.name.trim().toUpperCase(),
  tone: makerTone(input.tone),
  supplier_ids: input.supplierIds,
  medical_rep_ids: input.mrIds,
  is_quick: input.isQuick ?? false,
});

/** A manufacturer edit as `PATCH /app/manufacturers/:id` takes it — only what changed; null when nothing did. */
export function manufacturerChangeOf(
  record: ManufacturerRow,
  input: ManufacturerInput,
): ApiBody<'/app/manufacturers/{manufacturer_id}', 'patch'> | null {
  const change: ApiBody<'/app/manufacturers/{manufacturer_id}', 'patch'> = {};
  const name = input.name.trim().toUpperCase();
  if (name !== record.name) change.name = name;
  if (input.tone !== record.tone) change.tone = makerTone(input.tone);
  if (
    !sameIds(
      input.supplierIds,
      record.suppliers.map((supplier) => supplier.id),
    )
  ) {
    change.supplier_ids = input.supplierIds;
  }
  if (
    !sameIds(
      input.mrIds,
      record.mrs.map((mr) => mr.id),
    )
  ) {
    change.medical_rep_ids = input.mrIds;
  }
  if (Object.keys(change).length === 0) return null;
  return { ...change, expected_updated_at: record.updatedAt };
}

// ── MRs ──

/** MR: Name* · Phone · Next visit · the makers they represent (`medical.md:224–231`). */
export interface MedicalRepInput {
  name: string;
  phone: string | null;
  /** `YYYY-MM-DD`, or none. */
  nextVisitOn: string | null;
  manufacturerIds: string[];
}

/** A new MR as `POST /app/medical-reps` takes them. */
export const medicalRepCreateBodyOf = (
  input: MedicalRepInput,
): ApiBody<'/app/medical-reps', 'post'> => ({
  name: input.name.trim(),
  phone: input.phone,
  next_visit_on: input.nextVisitOn,
  manufacturer_ids: input.manufacturerIds,
});

/** An MR edit as `PATCH /app/medical-reps/:id` takes it — only what changed; null when nothing did. */
export function medicalRepChangeOf(
  record: MrRow,
  input: MedicalRepInput,
): ApiBody<'/app/medical-reps/{medical_rep_id}', 'patch'> | null {
  const change: ApiBody<'/app/medical-reps/{medical_rep_id}', 'patch'> = {};
  if (input.name.trim() !== record.name) change.name = input.name.trim();
  if (input.phone !== record.phone) change.phone = input.phone;
  if (input.nextVisitOn !== record.nextVisitOn) change.next_visit_on = input.nextVisitOn;
  if (!sameIds(input.manufacturerIds, record.manufacturerIds)) {
    change.manufacturer_ids = input.manufacturerIds;
  }
  if (Object.keys(change).length === 0) return null;
  return { ...change, expected_updated_at: record.updatedAt };
}

/**
 * Log MR visit (`medical.md:239–251`): the visit's date, samples and note, and the next visit it
 * sets on the MR.
 */
export interface MrVisitInput {
  mrId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  nextVisitOn: string | null;
  samples: string | null;
  notes: string | null;
}

/** A visit as `POST /app/medical-reps/:id/visits` takes it. */
export const mrVisitBodyOf = (
  input: MrVisitInput,
): ApiBody<'/app/medical-reps/{medical_rep_id}/visits', 'post'> => ({
  visit_date: input.date,
  ...(input.nextVisitOn ? { next_visit_on: input.nextVisitOn } : {}),
  ...(textOrNull(input.samples) ? { samples: textOrNull(input.samples) ?? '' } : {}),
  ...(textOrNull(input.notes) ? { notes: textOrNull(input.notes) ?? '' } : {}),
});

// ── Purchase orders ──

/**
 * One line of a purchase order: a medicine the store stocks — or a typed name the server adds as
 * a quick medicine (MD26) — how many, the free units and the rate, rupees.
 */
export interface PurchaseOrderLineInput {
  medicineId: string | null;
  /** A medicine not in the store yet, by its typed name. */
  newMedicineName?: string | null;
  qty: number;
  free: number;
  rate: number;
}

/**
 * New / Edit purchase order (`medical.md:254–267`): the supplier, its bill number, the order date
 * and the lines.
 */
export interface PurchaseOrderInput {
  supplierId: string;
  supplierBillNo: string | null;
  /** `YYYY-MM-DD`. */
  date: string;
  items: PurchaseOrderLineInput[];
}

/** A line in the API's words: the medicine, or the typed name of a new one. */
function orderLineOf(line: PurchaseOrderLineInput) {
  return {
    ...(line.medicineId
      ? { medicine_id: line.medicineId }
      : { new_medicine_name: (line.newMedicineName ?? '').trim() }),
    quantity: line.qty,
    free_quantity: line.free,
    rate: line.rate,
  };
}

/** A new order as `POST /app/medical-purchase-orders` takes it. */
export const purchaseOrderCreateBodyOf = (
  input: PurchaseOrderInput,
): ApiBody<'/app/medical-purchase-orders', 'post'> => ({
  supplier_id: input.supplierId,
  items: input.items.map(orderLineOf),
  ...(textOrNull(input.supplierBillNo)
    ? { supplier_bill_number: textOrNull(input.supplierBillNo) ?? '' }
    : {}),
  order_date: input.date,
});

/**
 * An order edit as `PATCH /app/medical-purchase-orders/:id` takes it — only what changed (the line
 * list whole when any line did), with the read's `updated_at`; null when nothing did.
 */
export function purchaseOrderChangeOf(
  record: PurchaseOrderRow,
  input: PurchaseOrderInput,
): ApiBody<'/app/medical-purchase-orders/{medical_purchase_order_id}', 'patch'> | null {
  const change: ApiBody<
    '/app/medical-purchase-orders/{medical_purchase_order_id}',
    'patch'
  > = {};
  if (input.supplierId !== record.supplier.id) change.supplier_id = input.supplierId;
  if (textOrNull(input.supplierBillNo) !== record.supplierBillNo) {
    change.supplier_bill_number = textOrNull(input.supplierBillNo);
  }
  if (input.date !== record.date) change.order_date = input.date;
  const lines = input.items.map(orderLineOf);
  const saved = record.lines.map((line) =>
    orderLineOf({
      medicineId: line.medicineId,
      qty: line.qty,
      free: line.free,
      rate: line.rate,
    }),
  );
  if (JSON.stringify(lines) !== JSON.stringify(saved)) change.items = lines;
  if (Object.keys(change).length === 0) return null;
  return { ...change, expected_updated_at: record.updatedAt };
}

/** One ordered line on Receive goods: whether it arrived, its batch and expiry (`medical.md:271–275`). */
interface ReceiveLineInput {
  /** The order line (`mpoi_…`). */
  id: string;
  arrived: boolean;
  batchNo: string | null;
  /** "MM/YY", or none. */
  expiry: string | null;
}

/**
 * A line that arrived but was not on the order — "+ Add unexpected item" (H:5388, MD26): the
 * medicine (or a typed name), how many and the free units, the rate, and its batch and expiry.
 */
interface ReceiveExtraInput extends PurchaseOrderLineInput {
  batchNo: string | null;
  expiry: string | null;
}

/** Receive goods: every ordered line, and what arrived that the order did not list. */
export interface ReceiveInput {
  lines: ReceiveLineInput[];
  extras?: ReceiveExtraInput[];
  /** The supplier's bill number, when it came with the goods. */
  supplierBillNo?: string | null;
}

/** A batch and expiry in the API's words — none when blank. */
function batchOf(batchNo: string | null, expiry: string | null) {
  return {
    ...(textOrNull(batchNo) ? { batch_number: textOrNull(batchNo) ?? '' } : {}),
    ...(expiry ? { expiry_month: wireExpiryOf(expiry) } : {}),
  };
}

/** A receipt as `POST /app/medical-purchase-orders/:id/receive` takes it. */
export const receiveBodyOf = (
  input: ReceiveInput,
): ApiBody<
  '/app/medical-purchase-orders/{medical_purchase_order_id}/receive',
  'post'
> => ({
  items: [
    ...input.lines.map((line) => ({
      id: line.id,
      is_received: line.arrived,
      ...(line.arrived ? batchOf(line.batchNo, line.expiry) : {}),
    })),
    ...(input.extras ?? []).map((extra) => ({
      ...orderLineOf(extra),
      ...batchOf(extra.batchNo, extra.expiry),
    })),
  ],
  ...(textOrNull(input.supplierBillNo ?? null)
    ? { supplier_bill_number: textOrNull(input.supplierBillNo ?? null) ?? '' }
    : {}),
});

// ── Sales ──

/** New sale (`createSale`): the buyer, the lines the server prices from their batches, and "Paid now". */
export interface SaleInput {
  branchId: string;
  /** The buyer's contact (`con_…`). */
  contactId: string;
  items: { medicineId: string; qty: number; discountPct: number }[];
  /** Off the whole bill, rupees. */
  overallDiscount: number;
  memberIds: string[];
  /** The prescription it fills, when it comes from one. */
  prescriptionId: string | null;
  remark: string | null;
  /** "Paid now" — needs `payment:create`. */
  payment: { splits: MoneySplit[] } | null;
}

/** A sale as `POST /app/medical-sales` takes it. */
export const saleBodyOf = (input: SaleInput): ApiBody<'/app/medical-sales', 'post'> => ({
  branch_id: input.branchId,
  contact_id: input.contactId,
  items: input.items.map((item) => ({
    medicine_id: item.medicineId,
    quantity: item.qty,
    // Always sent: left out, the server applies the medicine's near-expiry discount, so a
    // pharmacist's 0% would come back as that discount.
    discount_percent: item.discountPct,
  })),
  ...(input.overallDiscount > 0 ? { overall_discount: input.overallDiscount } : {}),
  ...(input.memberIds.length > 0 ? { member_ids: input.memberIds } : {}),
  ...(input.prescriptionId ? { patient_prescription_id: input.prescriptionId } : {}),
  ...(textOrNull(input.remark) ? { remark: textOrNull(input.remark) ?? '' } : {}),
  ...(input.payment && input.payment.splits.length > 0
    ? {
        payment: {
          splits: input.payment.splits.map(({ mode, amount }) => ({ mode, amount })),
        },
      }
    : {}),
});

/**
 * Return from patient (route 50, MD21): how many of each sold line come back, why, and how the
 * money goes back — or stays with the store as credit (MD33).
 */
export interface SaleReturnInput {
  lines: { invoiceItemId: string; qty: number }[];
  reason: SaleReturnReason;
  mode: RefundMode;
  note: string | null;
}

/** A return as `POST /app/medical-sales/:id/returns` takes it — the lines coming back only. */
export const saleReturnBodyOf = (
  input: SaleReturnInput,
): ApiBody<'/app/medical-sales/{medical_sale_id}/returns', 'post'> => ({
  items: input.lines
    .filter((line) => line.qty > 0)
    .map((line) => ({ invoice_item_id: line.invoiceItemId, quantity: line.qty })),
  reason: input.reason,
  refund_mode: input.mode,
  ...(textOrNull(input.note) ? { note: textOrNull(input.note) ?? '' } : {}),
});

// ── Supplier credits ──

/** Return expiring stock (`medical.md:297–309`, route 15): the supplier, the batch and how many packs. */
export interface ExpiringReturnInput {
  supplierId: string;
  /** The batch (`mbt_…`). */
  batchId: string;
  qty: number;
}

/** A supplier credit as `POST /app/suppliers/:id/credits` takes it. */
export const expiringReturnBodyOf = (
  input: ExpiringReturnInput,
): ApiBody<'/app/suppliers/{supplier_id}/credits', 'post'> => ({
  medicine_batch_id: input.batchId,
  quantity: input.qty,
});
