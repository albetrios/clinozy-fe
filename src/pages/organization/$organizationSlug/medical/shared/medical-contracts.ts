import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import type { CreatedFilter } from '@/shared/api/app/app-list-filters.ts';
import type { OfferingSpecialty, Tone } from '@/shared/api/app/app-schema.ts';
import {
  MAKER_TONE_VALUES,
  makerWire,
  type MedicineMaker,
  screenExpiryOf,
} from '@/shared/api/app/medicines-contracts.ts';

/*
 * The Medical store on clinozy-be (`/app/medical-sales`, `/app/medical-purchase-orders`,
 * `/app/suppliers` and their credits, `/app/manufacturers`, `/app/medical-reps` and their visits;
 * api-integration §5.5): the wire as the API answers it, and the rows the room reads. Money is
 * rupees as the API sends it; an expiry month is "MM/YY" on screen. What the server derives — a
 * sale's status, bill, due and margin, an order's total and due, a supplier's payable and ageing,
 * a manufacturer's counts, an MR's last visit — is read, never recomputed. Medicines are the
 * shared `medicines-contracts.ts` (other rooms read them too).
 */

/** A list read's sort direction. */
type SortOrder = 'asc' | 'desc';

/** A record a row names: its id and name. */
interface NamedRef {
  id: string;
  name: string;
}

// ── The wire ──

type ApiSaleDocumented = NonNullable<
  ApiData<'/app/medical-sales/{medical_sale_id}', 'get'>
>;
type ApiSaleDue = NonNullable<ApiData<'/app/medical-sales/dues', 'get'>>[number];
type ApiPurchaseOrderDocumented = NonNullable<
  ApiData<'/app/medical-purchase-orders/{medical_purchase_order_id}', 'get'>
>;
type ApiSupplierDocumented = NonNullable<ApiData<'/app/suppliers/{supplier_id}', 'get'>>;

/*
 * What change-pharmacy-record-fields added to these answers — a sale line's pack, HSN code and
 * units per pack, an order's note and each line's MRP, a supplier's email and address — which
 * clinozy-be's OpenAPI response map does not list yet (F1). Once `pnpm api:types` carries them,
 * each is its documented shape again.
 */
type ApiSaleLine = NonNullable<ApiSaleDocumented['items']>[number];
type ApiSale = Omit<ApiSaleDocumented, 'items'> & {
  items?: (ApiSaleLine & {
    pack_size?: string | null;
    hsn_code?: string | null;
    units_per_pack?: number;
  })[];
};
type ApiPurchaseOrderLine = NonNullable<ApiPurchaseOrderDocumented['items']>[number];
type ApiPurchaseOrder = Omit<ApiPurchaseOrderDocumented, 'items'> & {
  note?: string | null;
  items?: (ApiPurchaseOrderLine & { mrp?: number | null })[];
};
type ApiSupplier = ApiSupplierDocumented & {
  email?: string | null;
  address?: string | null;
};
type ApiManufacturer = NonNullable<
  ApiData<'/app/manufacturers/{manufacturer_id}', 'get'>
>;
type ApiMedicalRep = NonNullable<ApiData<'/app/medical-reps/{medical_rep_id}', 'get'>>;
type ApiMedicalRepVisit = NonNullable<
  ApiData<'/app/medical-reps/{medical_rep_id}/visits', 'post'>
>;
type ApiPrescriptionRow = NonNullable<
  ApiData<'/app/patient-prescriptions', 'get'>
>[number];
type ApiSupplierCredit = NonNullable<
  ApiData<'/app/suppliers/{supplier_id}/credits/{supplier_credit_id}', 'get'>
>;

/** A buyer as a sale and the dues name them: the contact and their primary number. */
const buyerWire = z.object({
  id: z.string(),
  name: z.string(),
  primary_phone: z.string(),
});

/** The reasons a patient brings medicine back, as the API names them (MD21). */
export const SALE_RETURN_REASONS = [
  'unused',
  'reaction',
  'doctor_changed',
  'wrong_item',
  'damaged',
] as const;

/** One return reason. */
export type SaleReturnReason = (typeof SALE_RETURN_REASONS)[number];

/** How a return's money goes back — or stays with the store as credit (MD33). */
export const REFUND_MODES = ['cash', 'upi', 'card', 'credit'] as const;

/** One refund mode. */
export type RefundMode = (typeof REFUND_MODES)[number];

/** A sale's status as the API reads it. */
const SALE_STATUSES = ['unpaid', 'paid', 'returned', 'voided'] as const;

/** One sale status. */
type SaleStatus = (typeof SALE_STATUSES)[number];

/** Why a sale is voided (MD20). */
const SALE_VOID_REASONS = [
  'billed_by_mistake',
  'wrong_items',
  'customer_changed_mind',
  'other',
] as const;

/** One void reason. */
export type SaleVoidReason = (typeof SALE_VOID_REASONS)[number];

/** One sale as `GET /app/medical-sales[/:medical_sale_id]` answers it. */
export const saleWire = wireSchema<ApiSale>()(
  z.object({
    id: z.string(),
    sale_number: z.number().int(),
    status: z.enum(SALE_STATUSES),
    contact: buyerWire.nullable(),
    patient_id: z.string().nullable(),
    branch_id: z.string(),
    invoice: z
      .object({
        id: z.string(),
        invoice_number: z.string(),
        total: z.number(),
        paid_amount: z.number(),
        due_amount: z.number(),
        payment_status: z.enum(['unpaid', 'partial', 'paid']),
      })
      .nullable(),
    items: z.array(
      z.object({
        invoice_item_id: z.string(),
        medicine_id: z.string().nullable(),
        name: z.string(),
        pack_size: z.string().nullable(),
        hsn_code: z.string().nullable(),
        units_per_pack: z.number().int(),
        batch_number: z.string().nullable(),
        expiry_month: z.string().nullable(),
        quantity: z.number().int(),
        rate: z.number(),
        discount_percent: z.number(),
        amount: z.number(),
        returned_quantity: z.number().int(),
      }),
    ),
    returned_amount: z.number(),
    margin_amount: z.number(),
    margin_percent: z.number().nullable(),
    member_ids: z.array(z.string()),
    patient_prescription_id: z.string().nullable(),
    remark: z.string().nullable(),
    returns: z.array(
      z.object({
        id: z.string(),
        reason: z.enum(SALE_RETURN_REASONS),
        refund_mode: z.enum(REFUND_MODES),
        note: z.string().nullable(),
        amount: z.number(),
        invoice_credit_note_id: z.string(),
        pending_credit_id: z.string().nullable(),
        items: z.array(
          z.object({
            invoice_item_id: z.string(),
            quantity: z.number().int(),
            amount: z.number(),
            is_restocked: z.boolean(),
          }),
        ),
        returned_by_membership_id: z.string().nullable(),
        created_at: z.string(),
      }),
    ),
    sold_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
    delete_reason: z.enum(SALE_VOID_REASONS).nullable(),
    delete_note: z.string().nullable(),
  }),
);

/** One row of `GET /app/medical-sales/dues`. */
export const saleDueWire = wireSchema<ApiSaleDue>()(
  z.object({
    contact: buyerWire.nullable(),
    patient_id: z.string().nullable(),
    due_total: z.number(),
    sale_count: z.number().int(),
    sales: z.array(
      z.object({
        id: z.string(),
        sale_number: z.number().int(),
        due_amount: z.number(),
        sold_at: z.string(),
      }),
    ),
    oldest_sold_at: z.string(),
  }),
);

/** Why an order is cancelled (MD15). */
const PURCHASE_CANCEL_REASONS = [
  'mistake',
  'supplier_cant_deliver',
  'price_changed',
  'other',
] as const;

/** One cancel reason. */
export type PurchaseCancelReason = (typeof PURCHASE_CANCEL_REASONS)[number];

/** One purchase order as `GET /app/medical-purchase-orders[/:id]` answers it. */
export const purchaseOrderWire = wireSchema<ApiPurchaseOrder>()(
  z.object({
    id: z.string(),
    purchase_order_number: z.number().int(),
    supplier: z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string().nullable(),
      gst_number: z.string().nullable(),
    }),
    supplier_bill_number: z.string().nullable(),
    order_date: z.string(),
    stage: z.enum(['ordered', 'received']),
    received_at: z.string().nullable(),
    note: z.string().nullable(),
    items: z.array(
      z.object({
        id: z.string(),
        line_number: z.number().int(),
        medicine_id: z.string(),
        medicine_name: z.string(),
        quantity: z.number().int(),
        free_quantity: z.number().int(),
        rate: z.number(),
        mrp: z.number().nullable(),
        amount: z.number(),
        is_received: z.boolean().nullable(),
        batch_number: z.string().nullable(),
        expiry_month: z.string().nullable(),
      }),
    ),
    item_count: z.number().int(),
    free_count: z.number().int(),
    total: z.number(),
    paid_amount: z.number(),
    credited_amount: z.number(),
    due_amount: z.number(),
    payment_status: z.enum(['unpaid', 'partial', 'paid']),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable(),
    delete_reason: z.enum(PURCHASE_CANCEL_REASONS).nullable(),
    delete_note: z.string().nullable(),
  }),
);

/** One supplier as `GET /app/suppliers[/:supplier_id]` answers it. */
export const supplierWire = wireSchema<ApiSupplier>()(
  z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    gst_number: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    is_quick: z.boolean(),
    manufacturers: z.array(makerWire),
    payable: z.number(),
    ageing_days: z.number().int().nullable(),
    order_count: z.number().int(),
    order_total: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** `GET /app/suppliers`' footer: the payable of every supplier the filters match. */
export const supplierListMetaWire = z.object({ payable_total: z.number() });

/** One manufacturer as `GET /app/manufacturers[/:manufacturer_id]` answers it. */
export const manufacturerWire = wireSchema<ApiManufacturer>()(
  z.object({
    id: z.string(),
    name: z.string(),
    tone: z.enum(MAKER_TONE_VALUES),
    is_quick: z.boolean(),
    medicine_count: z.number().int(),
    suppliers: z.array(z.object({ id: z.string(), name: z.string() })),
    medical_reps: z.array(z.object({ id: z.string(), name: z.string() })),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** One MR as `GET /app/medical-reps[/:medical_rep_id]` answers them. */
export const medicalRepWire = wireSchema<ApiMedicalRep>()(
  z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    next_visit_on: z.string().nullable(),
    is_visit_overdue: z.boolean(),
    last_visit_on: z.string().nullable(),
    last_samples: z.string().nullable(),
    manufacturers: z.array(makerWire),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** One logged visit as `…/visits` answers it. */
export const medicalRepVisitWire = wireSchema<ApiMedicalRepVisit>()(
  z.object({
    id: z.string(),
    medical_rep_id: z.string(),
    visit_date: z.string(),
    next_visit_on: z.string().nullable(),
    samples: z.string().nullable(),
    notes: z.string().nullable(),
    logged_by_membership_id: z.string().nullable(),
    created_at: z.string(),
  }),
);

/** Why a supplier credit is voided (MD32). */
export type SupplierCreditVoidReason =
  'mistake' | 'wrong_quantity' | 'supplier_refused' | 'other';

/** One supplier credit as `…/credits` answers it. */
export const supplierCreditWire = wireSchema<ApiSupplierCredit>()(
  z.object({
    id: z.string(),
    supplier_id: z.string(),
    supplier_name: z.string(),
    medicine_id: z.string(),
    medicine_name: z.string(),
    medicine_batch_id: z.string(),
    batch_number: z.string(),
    quantity: z.number().int(),
    rate: z.number(),
    amount: z.number(),
    applied_amount: z.number(),
    status: z.enum(['open', 'adjusted']),
    created_by_membership_id: z.string().nullable(),
    created_at: z.string(),
  }),
);

/** The parts of a prescription "Prescriptions to fill" reads. */
export const prescriptionToFillWire = wireSchema<ApiPrescriptionRow>()(
  z.object({
    id: z.string(),
    prescription_number: z.number().int(),
    patient_id: z.string(),
    patient: z
      .object({
        id: z.string(),
        patient_number: z.number().int(),
        contact_id: z.string(),
        name: z.string(),
      })
      .nullable(),
    prescription_date: z.string(),
    items: z.array(z.object({ medicine_name: z.string() })),
  }),
);

// ── Sales ──

/** Who bought: a contact, a patient when they have a file (the "P" badge). */
interface SaleCustomer {
  /** The contact (`con_…`). */
  id: string;
  name: string;
  phone: string | null;
  /** Their patient file, when they have one. */
  patientId: string | null;
}

/**
 * One sold line: the medicine from its batch, at its rate less its discount, and what came back.
 * Its quantity counts units — packs while the medicine sells whole packs (D5).
 */
export interface SaleLine {
  invoiceItemId: string;
  medicineId: string | null;
  name: string;
  /** The medicine's pack label when billed ("1*10"). */
  packSize: string | null;
  /** The medicine's HSN code when billed. */
  hsnCode: string | null;
  /** The medicine's units per pack — above 1 the line sold loose units. */
  unitsPerPack: number;
  qty: number;
  batchNo: string | null;
  /** "MM/YY". */
  expiry: string | null;
  /** What one unit sold at — the batch's MRP over its units per pack, rupees. */
  rate: number;
  discountPct: number;
  /** What the line comes to, rupees. */
  amount: number;
  /** How many have come back. */
  returnedQty: number;
}

/** One return from the patient: why, how the money went back, and its lines. */
export interface SaleReturn {
  id: string;
  reason: SaleReturnReason;
  refundMode: RefundMode;
  note: string | null;
  /** Rupees. */
  amount: number;
  creditNoteId: string;
  /** A store-credit return's credit (MD33). */
  pendingCreditId: string | null;
  items: { invoiceItemId: string; qty: number; amount: number; restocked: boolean }[];
  returnedById: string | null;
  at: string;
}

/** One sale's invoice: its number and money, rupees. */
interface SaleInvoice {
  id: string;
  /** "INV-25-0042". */
  number: string;
  total: number;
  paid: number;
  due: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
}

/**
 * One sale as the room reads it (`medical.md:29`): its number and status, the buyer, its invoice,
 * the lines and what came back, the margin, and — once voided — why. Money in rupees.
 */
export interface SaleRow {
  id: string;
  /** "S-983". */
  seq: number;
  status: SaleStatus;
  customer: SaleCustomer | null;
  branchId: string;
  invoice: SaleInvoice | null;
  lines: SaleLine[];
  /** The invoice's total. */
  bill: number;
  /** Paid on the invoice. */
  paid: number;
  /** Still due on the invoice. */
  due: number;
  /** Σ the returns. */
  returned: number;
  /** The margin over the batches' rates. */
  margin: number;
  marginPct: number | null;
  memberIds: string[];
  prescriptionId: string | null;
  remark: string | null;
  returns: SaleReturn[];
  soldAt: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidReason: SaleVoidReason | null;
  voidNote: string | null;
}

/** A sale as its row. */
export function toSaleRow(wire: z.infer<typeof saleWire>): SaleRow {
  return {
    id: wire.id,
    seq: wire.sale_number,
    status: wire.status,
    customer: wire.contact
      ? {
          id: wire.contact.id,
          name: wire.contact.name,
          phone: wire.contact.primary_phone || null,
          patientId: wire.patient_id,
        }
      : null,
    branchId: wire.branch_id,
    invoice: wire.invoice
      ? {
          id: wire.invoice.id,
          number: wire.invoice.invoice_number,
          total: wire.invoice.total,
          paid: wire.invoice.paid_amount,
          due: wire.invoice.due_amount,
          paymentStatus: wire.invoice.payment_status,
        }
      : null,
    lines: wire.items.map((item) => ({
      invoiceItemId: item.invoice_item_id,
      medicineId: item.medicine_id,
      name: item.name,
      packSize: item.pack_size,
      hsnCode: item.hsn_code,
      unitsPerPack: item.units_per_pack,
      qty: item.quantity,
      batchNo: item.batch_number,
      expiry: item.expiry_month ? screenExpiryOf(item.expiry_month) : null,
      rate: item.rate,
      discountPct: item.discount_percent,
      amount: item.amount,
      returnedQty: item.returned_quantity,
    })),
    bill: wire.invoice?.total ?? 0,
    paid: wire.invoice?.paid_amount ?? 0,
    due: wire.invoice?.due_amount ?? 0,
    returned: wire.returned_amount,
    margin: wire.margin_amount,
    marginPct: wire.margin_percent,
    memberIds: wire.member_ids,
    prescriptionId: wire.patient_prescription_id,
    remark: wire.remark,
    returns: wire.returns.map((entry) => ({
      id: entry.id,
      reason: entry.reason,
      refundMode: entry.refund_mode,
      note: entry.note,
      amount: entry.amount,
      creditNoteId: entry.invoice_credit_note_id,
      pendingCreditId: entry.pending_credit_id,
      items: entry.items.map((item) => ({
        invoiceItemId: item.invoice_item_id,
        qty: item.quantity,
        amount: item.amount,
        restocked: item.is_restocked,
      })),
      returnedById: entry.returned_by_membership_id,
      at: entry.created_at,
    })),
    soldAt: wire.sold_at,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
    voidedAt: wire.deleted_at,
    voidReason: wire.delete_reason,
    voidNote: wire.delete_note,
  };
}

/** The Sales list's Status filter beyond All (`medical.md:39`). */
type SaleStatusFilter = 'unpaid' | 'paid' | 'returned';

/** The Sales columns the server sorts by (`medical.md:31`). */
type SaleSortKey = 'seq' | 'customer' | 'bill';

/** The Sales read's params: the customer, "S-983" or a medicine; Status; Created; the sort. */
export interface SaleListParams {
  q?: string;
  status?: SaleStatusFilter;
  created?: CreatedFilter;
  sort?: SaleSortKey;
  order?: SortOrder;
}

/** A customer the store is owed by, as "Send payment reminders" lists them (`medical.md:17`). */
export interface SaleReminder {
  customer: SaleCustomer;
  /** Σ what their unpaid sales still owe, rupees. */
  due: number;
  /** Their unpaid sales, oldest first. */
  sales: { id: string; seq: number; due: number; soldAt: string }[];
}

/** A prescription still to fill (the pharmacy queue, MD29): its patient and their contact — the sale's buyer. */
export interface PrescriptionToFill {
  id: string;
  /** "Rx-58". */
  seq: number;
  patientId: string;
  /** The patient's contact — New sale's buyer. */
  contactId: string;
  patientName: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Its medicine names, in order. */
  medicines: string[];
}

/** A queued prescription as its row — none without its patient (a file since removed). */
export function toPrescriptionToFill(
  wire: z.infer<typeof prescriptionToFillWire>,
): PrescriptionToFill | null {
  if (!wire.patient) return null;
  return {
    id: wire.id,
    seq: wire.prescription_number,
    patientId: wire.patient.id,
    contactId: wire.patient.contact_id,
    patientName: wire.patient.name,
    date: wire.prescription_date,
    medicines: wire.items.map((item) => item.medicine_name),
  };
}

/** Who to remind, and the clinic the message is from. */
export interface SaleReminders {
  clinicName: string;
  customers: SaleReminder[];
}

/** A dues row as a reminder — none for a sale with no buyer on record. */
export function toSaleReminder(wire: z.infer<typeof saleDueWire>): SaleReminder | null {
  if (!wire.contact) return null;
  return {
    customer: {
      id: wire.contact.id,
      name: wire.contact.name,
      phone: wire.contact.primary_phone || null,
      patientId: wire.patient_id,
    },
    due: wire.due_total,
    sales: wire.sales.map((sale) => ({
      id: sale.id,
      seq: sale.sale_number,
      due: sale.due_amount,
      soldAt: sale.sold_at,
    })),
  };
}

// ── Purchase orders ──

/** An order's stage as the room shows it: Ordered, Received, or Paid once received and paid in full. */
type PurchaseStage = 'ordered' | 'received' | 'paid';

/** One line of a purchase order: packs, as the supplier sells them. Money in rupees. */
export interface PurchaseOrderLine {
  id: string;
  lineNo: number;
  medicineId: string;
  medicineName: string;
  qty: number;
  free: number;
  /** A pack's purchase rate. */
  rate: number;
  /** The MRP printed on the packs; the batch it fills takes it (D8). */
  mrp: number | null;
  amount: number;
  /** Ticked on Receive goods; null until the order is received. */
  received: boolean | null;
  batchNo: string | null;
  /** "MM/YY". */
  expiry: string | null;
}

/** One purchase order as the room reads it (`medical.md:61`). Money in rupees. */
export interface PurchaseOrderRow {
  id: string;
  /** "#431". */
  seq: number;
  supplier: { id: string; name: string; phone: string | null; gstNumber: string | null };
  supplierBillNo: string | null;
  /** The order date, `YYYY-MM-DD`. */
  date: string;
  /** Ordered or Received, as the API keeps it. */
  apiStage: 'ordered' | 'received';
  /** What the Stage chip shows — Paid once received and paid in full. */
  stage: PurchaseStage;
  receivedAt: string | null;
  /** What the desk noted ("30 DAYS DUE") — the one field a received order still changes (D10). */
  note: string | null;
  lines: PurchaseOrderLine[];
  itemCount: number;
  freeCount: number;
  total: number;
  paid: number;
  /** Set off by the supplier's credits (MD11). */
  credited: number;
  due: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  createdAt: string;
  updatedAt: string;
}

/** An order as its row. */
export function toPurchaseOrderRow(
  wire: z.infer<typeof purchaseOrderWire>,
): PurchaseOrderRow {
  return {
    id: wire.id,
    seq: wire.purchase_order_number,
    supplier: {
      id: wire.supplier.id,
      name: wire.supplier.name,
      phone: wire.supplier.phone,
      gstNumber: wire.supplier.gst_number,
    },
    supplierBillNo: wire.supplier_bill_number,
    date: wire.order_date,
    apiStage: wire.stage,
    stage:
      wire.stage === 'received' && wire.payment_status === 'paid' ? 'paid' : wire.stage,
    receivedAt: wire.received_at,
    note: wire.note,
    lines: wire.items.map((item) => ({
      id: item.id,
      lineNo: item.line_number,
      medicineId: item.medicine_id,
      medicineName: item.medicine_name,
      qty: item.quantity,
      free: item.free_quantity,
      rate: item.rate,
      mrp: item.mrp,
      amount: item.amount,
      received: item.is_received,
      batchNo: item.batch_number,
      expiry: item.expiry_month ? screenExpiryOf(item.expiry_month) : null,
    })),
    itemCount: wire.item_count,
    freeCount: wire.free_count,
    total: wire.total,
    paid: wire.paid_amount,
    credited: wire.credited_amount,
    due: wire.due_amount,
    paymentStatus: wire.payment_status,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

/**
 * What a purchase order's A4 sheet prints beyond the order (Q-M7): the clinic, and its main
 * branch's phone and GSTIN — an order names no branch. The supplier's are on the order.
 */
export interface PurchaseOrderSheet {
  order: PurchaseOrderRow;
  organization: { name: string; specialties: OfferingSpecialty[]; currency: string };
  branch: { phone: string; gstNumber: string | null };
}

/** The Purchases columns the server sorts by. */
type PurchaseOrderSortKey = 'seq' | 'date' | 'total';

/** The Purchases read's params: the supplier, "#431" or its bill; Stage; Created; the sort. */
export interface PurchaseOrderListParams {
  q?: string;
  stage?: PurchaseStage;
  created?: CreatedFilter;
  sort?: PurchaseOrderSortKey;
  order?: SortOrder;
}

// ── Suppliers ──

/**
 * One supplier as the room reads it (`medical.md:77`): the makers it distributes, its live orders
 * and their total, what it is owed — received orders' dues less its open credits — and for how
 * long. Money in rupees.
 */
export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  gstNumber: string | null;
  email: string | null;
  address: string | null;
  isQuick: boolean;
  manufacturers: MedicineMaker[];
  manufacturerIds: string[];
  orderCount: number;
  orderTotal: number;
  payable: number;
  /** Days since the oldest received order still due; `null` when nothing is due. */
  ageingDays: number | null;
  createdAt: string;
  updatedAt: string;
}

/** A supplier as its row. */
export function toSupplierRow(wire: z.infer<typeof supplierWire>): SupplierRow {
  return {
    id: wire.id,
    name: wire.name,
    phone: wire.phone,
    gstNumber: wire.gst_number,
    email: wire.email,
    address: wire.address,
    isQuick: wire.is_quick,
    manufacturers: wire.manufacturers,
    manufacturerIds: wire.manufacturers.map((maker) => maker.id),
    orderCount: wire.order_count,
    orderTotal: wire.order_total,
    payable: wire.payable,
    ageingDays: wire.ageing_days,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

/** The Suppliers columns the server sorts by (`medical.md:79`). */
type SupplierSortKey = 'name' | 'payable';

/** The Suppliers read's params: name or phone, a maker, "owed something", Created, the sort. */
export interface SupplierListParams {
  q?: string;
  manufacturer?: string;
  hasPayable?: boolean;
  created?: CreatedFilter;
  sort?: SupplierSortKey;
  order?: SortOrder;
}

/**
 * One row of a supplier's Account (`medical.md:200`): a purchase order — its stage, total and
 * what is still owed on it — or a credit from returned stock.
 */
export type SupplierAccountRow =
  | {
      kind: 'order';
      id: string;
      seq: number;
      billNo: string | null;
      date: string;
      stage: PurchaseStage;
      /** The order's total, rupees. */
      amount: number;
      /** Still owed on it. */
      due: number;
    }
  | {
      kind: 'credit';
      id: string;
      /** The returned batch: "Credit · 026-312". */
      batchNo: string;
      date: string;
      /** The credit, rupees (shown as a minus). */
      amount: number;
    };

// ── Supplier credits ──

/** One credit a supplier owes back for returned stock (MD11). Money in rupees. */
export interface SupplierCreditRow {
  id: string;
  supplierId: string;
  supplierName: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  /** Units — packs while the medicine sells whole packs. */
  qty: number;
  /** One unit's purchase rate: the pack's over its units per pack (D5). */
  rate: number;
  amount: number;
  /** Set against the supplier's orders. */
  applied: number;
  /** Open until fully applied, then Adjusted. */
  status: 'open' | 'adjusted';
  createdById: string | null;
  createdAt: string;
}

/** A supplier credit as its row. */
export function toSupplierCreditRow(
  wire: z.infer<typeof supplierCreditWire>,
): SupplierCreditRow {
  return {
    id: wire.id,
    supplierId: wire.supplier_id,
    supplierName: wire.supplier_name,
    medicineId: wire.medicine_id,
    medicineName: wire.medicine_name,
    batchId: wire.medicine_batch_id,
    batchNo: wire.batch_number,
    qty: wire.quantity,
    rate: wire.rate,
    amount: wire.amount,
    applied: wire.applied_amount,
    status: wire.status,
    createdById: wire.created_by_membership_id,
    createdAt: wire.created_at,
  };
}

/** The supplier credits' params: one supplier, "open" ones. */
export interface SupplierCreditListParams {
  supplier?: string;
  status?: 'open' | 'adjusted';
}

// ── Manufacturers ──

/** One manufacturer as the room reads it (`medical.md:93`): its medicines, suppliers and MRs. */
export interface ManufacturerRow {
  id: string;
  name: string;
  tone: Tone;
  isQuick: boolean;
  medicineCount: number;
  suppliers: NamedRef[];
  mrs: NamedRef[];
  createdAt: string;
  updatedAt: string;
}

/** A manufacturer as its row. */
export function toManufacturerRow(
  wire: z.infer<typeof manufacturerWire>,
): ManufacturerRow {
  return {
    id: wire.id,
    name: wire.name,
    tone: wire.tone,
    isQuick: wire.is_quick,
    medicineCount: wire.medicine_count,
    suppliers: wire.suppliers,
    mrs: wire.medical_reps,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

/** The Manufacturers read's params: name, a supplier, an MR, Created, the sort. */
export interface ManufacturerListParams {
  q?: string;
  supplier?: string;
  mr?: string;
  created?: CreatedFilter;
  sort?: 'name';
  order?: SortOrder;
}

// ── MRs ──

/** One MR as the room reads them (`medical.md:109`): the makers, the next and last visit. */
export interface MrRow {
  id: string;
  name: string;
  phone: string | null;
  nextVisitOn: string | null;
  /** The next visit has passed. */
  visitOverdue: boolean;
  lastVisitOn: string | null;
  samples: string | null;
  manufacturers: MedicineMaker[];
  manufacturerIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** An MR as their row. */
export function toMrRow(wire: z.infer<typeof medicalRepWire>): MrRow {
  return {
    id: wire.id,
    name: wire.name,
    phone: wire.phone,
    nextVisitOn: wire.next_visit_on,
    visitOverdue: wire.is_visit_overdue,
    lastVisitOn: wire.last_visit_on,
    samples: wire.last_samples,
    manufacturers: wire.manufacturers,
    manufacturerIds: wire.manufacturers.map((maker) => maker.id),
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

/** One logged visit. */
export interface MrVisitRow {
  id: string;
  mrId: string;
  date: string;
  nextVisitOn: string | null;
  samples: string | null;
  notes: string | null;
  loggedById: string | null;
  createdAt: string;
}

/** A visit as its row. */
export function toMrVisitRow(wire: z.infer<typeof medicalRepVisitWire>): MrVisitRow {
  return {
    id: wire.id,
    mrId: wire.medical_rep_id,
    date: wire.visit_date,
    nextVisitOn: wire.next_visit_on,
    samples: wire.samples,
    notes: wire.notes,
    loggedById: wire.logged_by_membership_id,
    createdAt: wire.created_at,
  };
}

/** The MRs read's params: name, Created, the sort. */
export interface MrListParams {
  q?: string;
  created?: CreatedFilter;
  sort?: 'name';
  order?: SortOrder;
}

/** A list's footer figures: how many rows match, and what the suppliers are owed. */
export interface MedicalListSummary {
  total: number;
  payable: number;
}
