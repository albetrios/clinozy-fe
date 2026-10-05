import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import type {
  Branch,
  Manufacturer,
  MedicalPurchaseOrder,
  MedicalRep,
  MedicalSale,
  Organization,
  PoStage,
  Supplier,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { MedicineMaker } from '@/shared/api/clinic/medicines-contracts.ts';

/*
 * The Medical family's read shapes (KICKOFF §6.7 Data): each list row is the
 * contract record (`S:741–858`) plus what the server derives for the list —
 * a backend request (Appendix F), served by the fixture server until then
 * (REPLACE_WITH_API). Medicines live in `@/shared/api/clinic/` (the Invoice
 * and Rx drawers read them); sales, purchase orders, suppliers,
 * manufacturers and MRs live here.
 */

/** A list read's sort direction. */
type SortOrder = 'asc' | 'desc';

/** A record a row names: its id and name. */
interface NamedRef {
  id: string;
  name: string;
}

// ── Sales ──

/** Who bought: a patient (the "P" badge) or a Medical contact. */
export interface SaleCustomer {
  kind: 'patient' | 'contact';
  id: string;
  name: string;
  phone: string | null;
}

/** One medicine line of a sale, at MRP (GST included, D45). */
export interface SaleLine {
  medicineId: string | null;
  name: string;
  qty: number;
  batchNo: string | null;
  /** Qty × the line's rate, paise. */
  amount: number;
}

/**
 * One Sales row (`medical.md:29`): the sale, its invoice's number and lines,
 * the bill and what was returned, the cost at the best buy rates (the hidden
 * Margin), and what is paid and due on the invoice.
 */
export interface SaleRow extends MedicalSale {
  invoiceSeq: number | null;
  customer: SaleCustomer | null;
  lines: SaleLine[];
  bill: number;
  /** Σ the returns' refunds, paise. */
  returned: number;
  /** Σ qty × the medicine's best buy rate, paise. */
  cost: number;
  paid: number;
  due: number;
  /** Paid when nothing is due on the invoice, else Unpaid. */
  status: 'paid' | 'unpaid';
}

/** The Sales list's Status filter beyond All (`medical.md:39`). */
type SaleStatusFilter = 'unpaid' | 'returned';

/** The Sales columns the server sorts by (`medical.md:31`). */
type SaleSortKey = 'seq' | 'customer' | 'bill';

/** `listMedicalSales`' params (`S:49`): Status, the customer or "#983", Created, the sort. */
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
  /** Σ what their unpaid sales still owe, paise. */
  due: number;
  /** Their unpaid sales' numbers, oldest first. */
  saleSeqs: number[];
}

/** Who to remind, and the clinic the message is from (REPLACE_WITH_API). */
export interface SaleReminders {
  clinicName: string;
  customers: SaleReminder[];
}

// ── Purchase orders ──

/**
 * One Purchases row (`medical.md:61`): the order, its supplier, its medicine
 * names, the free units, the total (Σ qty × rate) and what is still due.
 */
export interface PurchaseOrderRow extends MedicalPurchaseOrder {
  supplierName: string;
  itemNames: string[];
  freeCount: number;
  total: number;
  /** Total − paid while Received — an Ordered order is not billed yet, a Paid one is settled. */
  due: number;
}

/**
 * What a purchase order's A4 sheet prints beyond the order (Q-M7): its
 * supplier, and the clinic with its branch's phone and GSTIN.
 */
export interface PurchaseOrderSheet {
  order: PurchaseOrderRow;
  supplier: Pick<Supplier, 'name' | 'phone' | 'gstNumber'>;
  organization: Pick<Organization, 'name' | 'specialties' | 'currency'>;
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
}

/** The Stage filter's values (`medical.md:71`) — cancelled orders leave the list. */
export type PurchaseStageFilter = Exclude<PoStage, 'cancelled'>;

/** The Purchases columns the server sorts by (`medical.md:63`). */
type PurchaseOrderSortKey = 'seq' | 'supplier' | 'total' | 'stage';

/**
 * `listPurchaseOrders`' params (`S:56`): Stage, the supplier / "#431" / bill,
 * Created, the sort. The contract's `supplier` filter has no control on the
 * screen, and `?supplier=` is New purchase order's prefill (`S:57`), so the
 * list does not read it.
 */
export interface PurchaseOrderListParams {
  q?: string;
  stage?: PurchaseStageFilter;
  created?: CreatedFilter;
  sort?: PurchaseOrderSortKey;
  order?: SortOrder;
}

// ── Suppliers ──

/**
 * One Suppliers row (`medical.md:77`): the supplier, the makers it
 * distributes, its live orders, what it is owed (received orders not paid in
 * full) and for how long, and its oldest open bill — where "Pay ₹X" opens.
 */
export interface SupplierRow extends Supplier {
  manufacturers: MedicineMaker[];
  orderCount: number;
  /** Σ the live orders' totals, paise. */
  orderTotal: number;
  payable: number;
  /** Days since the oldest open bill; `null` when nothing is due. */
  ageingDays: number | null;
  /** An order still Ordered or Received — Delete waits for it. */
  hasOpenOrder: boolean;
  /** The oldest received order not paid in full. */
  oldestOpenBill: { id: string; seq: number; due: number } | null;
}

/** The Suppliers columns the server sorts by (`medical.md:79`). */
type SupplierSortKey = 'name' | 'payable';

/** `listSuppliers`' params (`S:61`): name, any of these makers, Created, the sort. */
export interface SupplierListParams {
  q?: string;
  manufacturer?: readonly string[];
  created?: CreatedFilter;
  sort?: SupplierSortKey;
  order?: SortOrder;
}

// ── Manufacturers ──

/** One Manufacturers row (`medical.md:93`): the maker, its medicines, who distributes and represents it. */
export interface ManufacturerRow extends Manufacturer {
  medicineCount: number;
  suppliers: NamedRef[];
  mrs: NamedRef[];
}

/** `listManufacturers`' params (`S:64`): name, any of these suppliers or MRs, Created, the sort. */
export interface ManufacturerListParams {
  q?: string;
  suppliers?: readonly string[];
  mrs?: readonly string[];
  created?: CreatedFilter;
  sort?: 'name';
  order?: SortOrder;
}

// ── MRs ──

/** One MRs row (`medical.md:109`): the rep, the makers they represent, their last visit and its samples. */
export interface MrRow extends MedicalRep {
  manufacturers: MedicineMaker[];
  lastVisitOn: string | null;
  samples: string | null;
}

/** `listMedicalReps`' params (`S:67`): name, Created, the sort. */
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

/** The PO stages in the order a sort and the Stage filter read them. */
export const PURCHASE_STAGE_ORDER: readonly PurchaseStageFilter[] = [
  'ordered',
  'received',
  'paid',
];
