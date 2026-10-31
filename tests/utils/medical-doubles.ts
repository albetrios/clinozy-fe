/**
 * Test data for the Medical store as clinozy-be answers it (`/app/medicines`,
 * `/app/medical-sales`, `/app/medical-purchase-orders`, `/app/suppliers` and their credits,
 * `/app/manufacturers`, `/app/medical-reps`) — the wire rows as the API sends them and the room's
 * rows they map to. Ids are public ids (`<prefix>_<21 [a-z0-9]>`); money is rupees. Override
 * what a test is about; the rest stays Azelaic gel from SUN PHARMA, bought from Ankur Pharma and
 * sold to Priya Shah.
 */
import type {
  ManufacturerRow,
  MrRow,
  MrVisitRow,
  PrescriptionToFill,
  PurchaseOrderRow,
  SaleRow,
  SupplierCreditRow,
  SupplierRow,
} from '@/pages/organization/$organizationSlug/medical/shared/medical-contracts.ts';
import type { MedicineRow } from '@/shared/api/app/medicines-contracts.ts';

/** SUN PHARMA's manufacturer id. */
export const TEST_MAKER_ID = 'mfr_sunpharma000000000000';

/** Ankur Pharma's supplier id. */
export const TEST_SUPPLIER_ID = 'sup_ankur0000000000000000';

/** Rahul Mehta, SUN PHARMA's MR. */
export const TEST_MR_ID = 'mrep_rahul0000000000000000';

/** Azelaic gel's medicine id. */
export const TEST_MEDICINE_ID = 'med_azel00000000000000000';

/** Its one batch in stock. */
export const TEST_BATCH_ID = 'mbt_azel02600000000000000';

/** Purchase order #431. */
export const TEST_PURCHASE_ORDER_ID = 'mpo_order4310000000000000';

/** Its one line. */
export const TEST_PURCHASE_ORDER_ITEM_ID = 'mpoi_line00000000000000000';

/** Sale #978. */
export const TEST_SALE_ID = 'msal_sale97800000000000000';

/** The sale's invoice and its one line. */
export const TEST_SALE_INVOICE_ID = 'invc_sale97800000000000000';
export const TEST_SALE_INVOICE_ITEM_ID = 'iitm_line00000000000000000';

/** Priya Shah — the buyer's contact and patient file. */
export const TEST_BUYER_CONTACT_ID = 'con_priya0000000000000000';
export const TEST_BUYER_PATIENT_ID = 'pat_priya0000000000000000';

/** A supplier credit for returned stock. */
export const TEST_SUPPLIER_CREDIT_ID = 'scr_credit000000000000000';

/** An MR visit. */
export const TEST_MR_VISIT_ID = 'mrv_visit0000000000000000';

/** Prescription Rx-58. */
export const TEST_PRESCRIPTION_ID = 'rx_rx5800000000000000000';

/** The pharmacist who rang it up. */
export const TEST_MEDICAL_AUTHOR_ID = 'mem_pharma000000000000000';

/** The main branch. */
export const TEST_MEDICAL_BRANCH_ID = 'brn_main00000000000000000';

const CREATED_AT = '2026-10-01T05:00:00.000Z';
const UPDATED_AT = '2026-10-09T08:00:00.000Z';

const MAKER = { id: TEST_MAKER_ID, name: 'SUN PHARMA', tone: 'sky' as const };

// ── The wire ──

/** A medicine as the API answers it — 12 tubes of Azelaic gel at ₹650, one batch to 12/27. */
export const medicineWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_MEDICINE_ID,
  medicine_number: 458,
  name: 'Azelaic gel 15g',
  composition: 'Azelaic acid 15%',
  manufacturer: MAKER,
  is_prescription_only: false,
  hsn_code: null,
  pack_label: null,
  units_per_pack: 1,
  mrp: 650,
  gst_percent: 12,
  price_before_gst: 580.36,
  min_stock: 2,
  max_stock: 20,
  quantity: 12,
  stock_level: 'ok',
  nearest_expiry: { expiry_month: '2027-12', batch_number: '026-312' },
  near_expiry_discount_percent: null,
  best_rate: { rate: 420, supplier_id: TEST_SUPPLIER_ID, supplier_name: 'Ankur Pharma' },
  margin_percent: 35.38,
  is_quick: false,
  needs_details: false,
  batches: [
    {
      id: TEST_BATCH_ID,
      batch_number: '026-312',
      expiry_month: '2027-12',
      quantity: 12,
      purchase_rate: 420,
      mrp: null,
      supplier_id: TEST_SUPPLIER_ID,
      is_expired: false,
    },
  ],
  supplier_prices: [
    {
      supplier_id: TEST_SUPPLIER_ID,
      supplier_name: 'Ankur Pharma',
      rate: 420,
      free_quantity: 0,
      lead_days: 2,
    },
  ],
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** A supplier as the API answers it — owed ₹827 for 5 days, two orders. */
export const supplierWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_SUPPLIER_ID,
  name: 'Ankur Pharma',
  phone: '+919876500011',
  gst_number: '24AAACA1234F1Z5',
  email: null,
  address: null,
  is_quick: false,
  manufacturers: [MAKER],
  payable: 827,
  ageing_days: 5,
  order_count: 2,
  order_total: 4236,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** A manufacturer as the API answers it — 14 medicines, one supplier, one MR. */
export const manufacturerWire = (patch: Record<string, unknown> = {}) => ({
  ...MAKER,
  is_quick: false,
  medicine_count: 14,
  suppliers: [{ id: TEST_SUPPLIER_ID, name: 'Ankur Pharma' }],
  medical_reps: [{ id: TEST_MR_ID, name: 'Rahul Mehta' }],
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** An MR as the API answers them — next visit on 20 Oct, last on 1 Oct. */
export const medicalRepWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_MR_ID,
  name: 'Rahul Mehta',
  phone: '+919812300022',
  next_visit_on: '2026-10-20',
  is_visit_overdue: false,
  last_visit_on: '2026-10-01',
  last_samples: 'Azelaic gel ×4',
  manufacturers: [MAKER],
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** A logged visit as the API answers it. */
export const medicalRepVisitWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_MR_VISIT_ID,
  medical_rep_id: TEST_MR_ID,
  visit_date: '2026-10-01',
  next_visit_on: '2026-10-20',
  samples: 'Azelaic gel ×4',
  notes: null,
  logged_by_membership_id: TEST_MEDICAL_AUTHOR_ID,
  created_at: '2026-10-01T06:00:00.000Z',
  ...patch,
});

/** Purchase order #431 as the API answers it — received, ₹4,236, ₹827 still due. */
export const purchaseOrderWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_PURCHASE_ORDER_ID,
  purchase_order_number: 431,
  supplier: {
    id: TEST_SUPPLIER_ID,
    name: 'Ankur Pharma',
    phone: '+919876500011',
    gst_number: '24AAACA1234F1Z5',
  },
  supplier_bill_number: 'T-82370',
  order_date: '2026-10-04',
  stage: 'received',
  received_at: '2026-10-06T07:00:00.000Z',
  note: null,
  items: [
    {
      id: TEST_PURCHASE_ORDER_ITEM_ID,
      line_number: 1,
      medicine_id: TEST_MEDICINE_ID,
      medicine_name: 'Azelaic gel 15g',
      quantity: 10,
      free_quantity: 1,
      rate: 423.6,
      mrp: null,
      amount: 4236,
      is_received: true,
      batch_number: '026-312',
      expiry_month: '2027-12',
    },
  ],
  item_count: 1,
  free_count: 1,
  total: 4236,
  paid_amount: 3409,
  credited_amount: 0,
  due_amount: 827,
  payment_status: 'partial',
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  deleted_at: null,
  delete_reason: null,
  delete_note: null,
  ...patch,
});

/** Sale #978 as the API answers it — two tubes for ₹1,300, unpaid. */
export const saleWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_SALE_ID,
  sale_number: 978,
  status: 'unpaid',
  contact: {
    id: TEST_BUYER_CONTACT_ID,
    name: 'Priya Shah',
    primary_phone: '+919900011122',
  },
  patient_id: TEST_BUYER_PATIENT_ID,
  branch_id: TEST_MEDICAL_BRANCH_ID,
  invoice: {
    id: TEST_SALE_INVOICE_ID,
    invoice_number: 'INV-25-0042',
    total: 1300,
    paid_amount: 0,
    due_amount: 1300,
    payment_status: 'unpaid',
  },
  items: [
    {
      invoice_item_id: TEST_SALE_INVOICE_ITEM_ID,
      medicine_id: TEST_MEDICINE_ID,
      name: 'Azelaic gel 15g',
      pack_size: null,
      hsn_code: null,
      units_per_pack: 1,
      batch_number: '026-312',
      expiry_month: '2027-12',
      quantity: 2,
      rate: 650,
      discount_percent: 0,
      amount: 1300,
      returned_quantity: 0,
    },
  ],
  returned_amount: 0,
  margin_amount: 460,
  margin_percent: 35.38,
  member_ids: [TEST_MEDICAL_AUTHOR_ID],
  patient_prescription_id: null,
  remark: null,
  returns: [],
  sold_at: '2026-10-10T05:30:00.000Z',
  created_at: '2026-10-10T05:30:00.000Z',
  updated_at: '2026-10-10T05:30:00.000Z',
  deleted_at: null,
  delete_reason: null,
  delete_note: null,
  ...patch,
});

/** A dues row as the API answers it — Priya Shah owes ₹1,300 on sale #978. */
export const saleDueWire = (patch: Record<string, unknown> = {}) => ({
  contact: {
    id: TEST_BUYER_CONTACT_ID,
    name: 'Priya Shah',
    primary_phone: '+919900011122',
  },
  patient_id: TEST_BUYER_PATIENT_ID,
  due_total: 1300,
  sale_count: 1,
  sales: [
    {
      id: TEST_SALE_ID,
      sale_number: 978,
      due_amount: 1300,
      sold_at: '2026-10-10T05:30:00.000Z',
    },
  ],
  oldest_sold_at: '2026-10-10T05:30:00.000Z',
  ...patch,
});

/** A supplier credit as the API answers it — two tubes back to Ankur Pharma, ₹840, open. */
export const supplierCreditWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_SUPPLIER_CREDIT_ID,
  supplier_id: TEST_SUPPLIER_ID,
  supplier_name: 'Ankur Pharma',
  medicine_id: TEST_MEDICINE_ID,
  medicine_name: 'Azelaic gel 15g',
  medicine_batch_id: TEST_BATCH_ID,
  batch_number: '026-312',
  quantity: 2,
  rate: 420,
  amount: 840,
  applied_amount: 0,
  status: 'open',
  created_by_membership_id: TEST_MEDICAL_AUTHOR_ID,
  created_at: '2026-10-08T05:00:00.000Z',
  ...patch,
});

/** Rx-58 as `GET /app/patient-prescriptions` answers it — approved, not filled yet. */
export const prescriptionToFillWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_PRESCRIPTION_ID,
  prescription_number: 58,
  patient_id: TEST_BUYER_PATIENT_ID,
  patient: {
    id: TEST_BUYER_PATIENT_ID,
    patient_number: 2363,
    contact_id: TEST_BUYER_CONTACT_ID,
    name: 'Priya Shah',
  },
  prescription_date: '2026-10-10',
  items: [{ medicine_name: 'Azelaic gel 15g' }],
  ...patch,
});

// ── The rows ──

/** A Medicines row: Azelaic gel, 12 in stock, best from Ankur Pharma. */
export function medicineRow(overrides: Partial<MedicineRow> = {}): MedicineRow {
  return {
    id: TEST_MEDICINE_ID,
    seq: 458,
    name: 'Azelaic gel 15g',
    composition: 'Azelaic acid 15%',
    manufacturer: MAKER,
    prescriptionOnly: false,
    hsnCode: null,
    packLabel: null,
    unitsPerPack: 1,
    mrp: 650,
    gstPct: 12,
    priceBeforeGst: 580.36,
    minStock: 2,
    maxStock: 20,
    stock: 12,
    stockLevel: 'ok',
    nearest: { batchNo: '026-312', expiry: '12/27', daysLeft: 444 },
    nearExpiryDiscountPct: 0,
    bestRate: { supplierId: TEST_SUPPLIER_ID, supplierName: 'Ankur Pharma', rate: 420 },
    margin: 35.38,
    isQuick: false,
    needsDetails: false,
    batches: [
      {
        id: TEST_BATCH_ID,
        batchNo: '026-312',
        expiry: '12/27',
        qty: 12,
        purchaseRate: 420,
        mrp: null,
        supplierId: TEST_SUPPLIER_ID,
        expired: false,
      },
    ],
    supplierRates: [
      {
        supplierId: TEST_SUPPLIER_ID,
        supplierName: 'Ankur Pharma',
        rate: 420,
        free: 0,
        leadDays: 2,
      },
    ],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** A Suppliers row: Ankur Pharma, owed ₹827 for 5 days. */
export function supplierRow(overrides: Partial<SupplierRow> = {}): SupplierRow {
  return {
    id: TEST_SUPPLIER_ID,
    name: 'Ankur Pharma',
    phone: '+919876500011',
    gstNumber: '24AAACA1234F1Z5',
    email: null,
    address: null,
    isQuick: false,
    manufacturers: [MAKER],
    manufacturerIds: [TEST_MAKER_ID],
    orderCount: 2,
    orderTotal: 4236,
    payable: 827,
    ageingDays: 5,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** A Manufacturers row: SUN PHARMA with its supplier and MR. */
export function manufacturerRow(
  overrides: Partial<ManufacturerRow> = {},
): ManufacturerRow {
  return {
    ...MAKER,
    isQuick: false,
    medicineCount: 14,
    suppliers: [{ id: TEST_SUPPLIER_ID, name: 'Ankur Pharma' }],
    mrs: [{ id: TEST_MR_ID, name: 'Rahul Mehta' }],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** An MRs row: Rahul Mehta for SUN PHARMA. */
export function mrRow(overrides: Partial<MrRow> = {}): MrRow {
  return {
    id: TEST_MR_ID,
    name: 'Rahul Mehta',
    phone: '+919812300022',
    nextVisitOn: '2026-10-20',
    visitOverdue: false,
    lastVisitOn: '2026-10-01',
    samples: 'Azelaic gel ×4',
    manufacturers: [MAKER],
    manufacturerIds: [TEST_MAKER_ID],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** One of Rahul Mehta's visits. */
export function mrVisitRow(overrides: Partial<MrVisitRow> = {}): MrVisitRow {
  return {
    id: TEST_MR_VISIT_ID,
    mrId: TEST_MR_ID,
    date: '2026-10-01',
    nextVisitOn: '2026-10-20',
    samples: 'Azelaic gel ×4',
    notes: null,
    loggedById: TEST_MEDICAL_AUTHOR_ID,
    createdAt: '2026-10-01T06:00:00.000Z',
    ...overrides,
  };
}

/** A Purchases row: PO #431, received, ₹827 still due. */
export function purchaseOrderRow(
  overrides: Partial<PurchaseOrderRow> = {},
): PurchaseOrderRow {
  return {
    id: TEST_PURCHASE_ORDER_ID,
    seq: 431,
    supplier: {
      id: TEST_SUPPLIER_ID,
      name: 'Ankur Pharma',
      phone: '+919876500011',
      gstNumber: '24AAACA1234F1Z5',
    },
    supplierBillNo: 'T-82370',
    date: '2026-10-04',
    apiStage: 'received',
    stage: 'received',
    receivedAt: '2026-10-06T07:00:00.000Z',
    note: null,
    lines: [
      {
        id: TEST_PURCHASE_ORDER_ITEM_ID,
        lineNo: 1,
        medicineId: TEST_MEDICINE_ID,
        medicineName: 'Azelaic gel 15g',
        qty: 10,
        free: 1,
        rate: 423.6,
        mrp: null,
        amount: 4236,
        received: true,
        batchNo: '026-312',
        expiry: '12/27',
      },
    ],
    itemCount: 1,
    freeCount: 1,
    total: 4236,
    paid: 3409,
    credited: 0,
    due: 827,
    paymentStatus: 'partial',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

/** A Sales row: sale #978 to Priya Shah, two tubes, unpaid. */
export function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: TEST_SALE_ID,
    seq: 978,
    status: 'unpaid',
    customer: {
      id: TEST_BUYER_CONTACT_ID,
      name: 'Priya Shah',
      phone: '+919900011122',
      patientId: TEST_BUYER_PATIENT_ID,
    },
    branchId: TEST_MEDICAL_BRANCH_ID,
    invoice: {
      id: TEST_SALE_INVOICE_ID,
      number: 'INV-25-0042',
      total: 1300,
      paid: 0,
      due: 1300,
      paymentStatus: 'unpaid',
    },
    lines: [
      {
        invoiceItemId: TEST_SALE_INVOICE_ITEM_ID,
        medicineId: TEST_MEDICINE_ID,
        name: 'Azelaic gel 15g',
        packSize: null,
        hsnCode: null,
        unitsPerPack: 1,
        qty: 2,
        batchNo: '026-312',
        expiry: '12/27',
        rate: 650,
        discountPct: 0,
        amount: 1300,
        returnedQty: 0,
      },
    ],
    bill: 1300,
    paid: 0,
    due: 1300,
    returned: 0,
    margin: 460,
    marginPct: 35.38,
    memberIds: [TEST_MEDICAL_AUTHOR_ID],
    prescriptionId: null,
    remark: null,
    returns: [],
    soldAt: '2026-10-10T05:30:00.000Z',
    createdAt: '2026-10-10T05:30:00.000Z',
    updatedAt: '2026-10-10T05:30:00.000Z',
    voidedAt: null,
    voidReason: null,
    voidNote: null,
    ...overrides,
  };
}

/** Sale #978 paid in full — what a return needs. */
export function paidSaleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  const sale = saleRow();
  return saleRow({
    status: 'paid',
    paid: 1300,
    due: 0,
    invoice: sale.invoice
      ? { ...sale.invoice, paid: 1300, due: 0, paymentStatus: 'paid' }
      : null,
    ...overrides,
  });
}

/** A supplier credit: two tubes of batch 026-312 back to Ankur Pharma, ₹840, open. */
export function supplierCreditRow(
  overrides: Partial<SupplierCreditRow> = {},
): SupplierCreditRow {
  return {
    id: TEST_SUPPLIER_CREDIT_ID,
    supplierId: TEST_SUPPLIER_ID,
    supplierName: 'Ankur Pharma',
    medicineId: TEST_MEDICINE_ID,
    medicineName: 'Azelaic gel 15g',
    batchId: TEST_BATCH_ID,
    batchNo: '026-312',
    qty: 2,
    rate: 420,
    amount: 840,
    applied: 0,
    status: 'open',
    createdById: TEST_MEDICAL_AUTHOR_ID,
    createdAt: '2026-10-08T05:00:00.000Z',
    ...overrides,
  };
}

/** Rx-58 in the pharmacy queue: Priya Shah's Azelaic gel. */
export function prescriptionToFill(
  overrides: Partial<PrescriptionToFill> = {},
): PrescriptionToFill {
  return {
    id: TEST_PRESCRIPTION_ID,
    seq: 58,
    patientId: TEST_BUYER_PATIENT_ID,
    contactId: TEST_BUYER_CONTACT_ID,
    patientName: 'Priya Shah',
    date: '2026-10-10',
    medicines: ['Azelaic gel 15g'],
    ...overrides,
  };
}

/** One page of rows, as a list read answers it: the last page unless `next` is given. */
export function medicalPage<T>(rows: T[], next: string | null = null) {
  return { rows, next, total: rows.length };
}
