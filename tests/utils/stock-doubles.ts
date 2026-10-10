/**
 * Test data for Clinic stock as clinozy-be answers it (`/app/stock-items`,
 * `/app/stock-item-movements`, `/app/stock-purchases`, `/app/stock-vendors`) — the
 * wire rows as the API sends them (read from the local stack) and the room's rows they map
 * to. Ids are public ids (`<prefix>_<21 [a-z0-9]>`). Override what a test is about; the rest
 * stays Soframycin, three tubes of 30 g from Ankur Pharma, and its one bill.
 */
import type {
  StockItemRow,
  StockMovementRow,
  StockPurchaseRow,
  StockVendorRow,
} from '@/pages/organization/$organizationSlug/stock/shared/stock-contracts.ts';

/** Ankur Pharma's vendor id. */
export const TEST_STOCK_VENDOR_ID = 'svnd_ankur0000000000000000';

/** Soframycin's item id. */
export const TEST_STOCK_ITEM_ID = 'sitm_sofra0000000000000000';

/** Bill #16's purchase id. */
export const TEST_STOCK_PURCHASE_ID = 'spur_bill16000000000000000';

/** A use of Soframycin. */
export const TEST_STOCK_MOVEMENT_ID = 'smov_use000000000000000000';

/** The member who logged it. */
export const TEST_STOCK_AUTHOR_ID = 'mem_nisha0000000000000000';

const CREATED_AT = '2026-10-01T05:00:00.000Z';
const UPDATED_AT = '2026-10-09T08:00:00.000Z';

/** A clinic vendor as the API answers them — owed ₹1,500. */
export const stockVendorWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_STOCK_VENDOR_ID,
  name: 'Ankur Pharma',
  phone: '+919876500011',
  is_quick: false,
  payable: 1500,
  purchase_count: 2,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** An item as the API answers it — 3 tubes of 30 g, half a tube a week. */
export const stockItemWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_STOCK_ITEM_ID,
  stock_item_number: 167,
  name: 'Soframycin 30 gm',
  category: 'creams_serums',
  unit: 'tube',
  size_per_unit: 30,
  measure_unit: 'g',
  quantity: 3,
  min_quantity: 1,
  max_quantity: 5,
  usage_per_week: 0.5,
  stock_vendor_id: TEST_STOCK_VENDOR_ID,
  last_rate: 250.5,
  stock_level: 'ok',
  lasts_days: 42,
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** A purchase as the API answers it — ₹2,392.50, ₹892.50 paid. */
export const stockPurchaseWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_STOCK_PURCHASE_ID,
  stock_purchase_number: 16,
  stock_vendor_id: TEST_STOCK_VENDOR_ID,
  bill_number: 'INV-221',
  purchase_date: '2026-10-09',
  items: [
    {
      line_number: 1,
      stock_item_id: TEST_STOCK_ITEM_ID,
      quantity: 5,
      rate: 250.5,
      amount: 1252.5,
    },
  ],
  bill_amount: 2392.5,
  paid_amount: 892.5,
  due_amount: 1500,
  payment_status: 'partial',
  payment_ids: ['pay_35tperctcuf576w6l4i3j'],
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  ...patch,
});

/** A movement as the API answers it — half a tube used for an LHR. */
export const stockMovementWire = (patch: Record<string, unknown> = {}) => ({
  id: TEST_STOCK_MOVEMENT_ID,
  stock_item_id: TEST_STOCK_ITEM_ID,
  type: 'used',
  quantity_change: -0.5,
  quantity_after: 2.5,
  used_for: 'LHR · Dharti Galani',
  note: null,
  patient_treatment_id: null,
  stock_purchase_id: null,
  stock_purchase_number: null,
  bill_number: null,
  stock_count_id: null,
  reverts_stock_item_movement_id: null,
  reverts_type: null,
  reverts_created_at: null,
  reverted_by_stock_item_movement_id: null,
  revert_reason: null,
  author_membership_id: TEST_STOCK_AUTHOR_ID,
  created_at: '2026-10-10T05:35:00.000Z',
  ...patch,
});

/** A Vendors row — two purchases, owed ₹1,500. */
export function stockVendorRow(overrides: Partial<StockVendorRow> = {}): StockVendorRow {
  return {
    id: TEST_STOCK_VENDOR_ID,
    name: 'Ankur Pharma',
    phone: '+919876500011',
    isQuick: false,
    payable: 1500,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    purchaseCount: 2,
    ...overrides,
  };
}

/** An Items row: Soframycin with its vendor. */
export function stockItemRow(overrides: Partial<StockItemRow> = {}): StockItemRow {
  return {
    id: TEST_STOCK_ITEM_ID,
    seq: 167,
    name: 'Soframycin 30 gm',
    category: 'creams_serums',
    unit: 'tube',
    sizePerUnit: 30_000,
    measureUnit: 'g',
    qtyMilli: 3000,
    minQty: 1,
    maxQty: 5,
    usagePerWeekMilli: 500,
    vendorId: TEST_STOCK_VENDOR_ID,
    level: 'ok',
    lastsDays: 42,
    lastRate: 250.5,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    vendor: { id: TEST_STOCK_VENDOR_ID, name: 'Ankur Pharma', phone: '+919876500011' },
    ...overrides,
  };
}

/** A Purchases row: bill #16, partly paid, with its vendor. */
export function stockPurchaseRow(
  overrides: Partial<StockPurchaseRow> = {},
): StockPurchaseRow {
  return {
    id: TEST_STOCK_PURCHASE_ID,
    seq: 16,
    vendorId: TEST_STOCK_VENDOR_ID,
    billNo: 'INV-221',
    date: '2026-10-09',
    lines: [
      {
        lineNumber: 1,
        itemId: TEST_STOCK_ITEM_ID,
        qtyMilli: 5000,
        rate: 250.5,
        amount: 1252.5,
      },
    ],
    bill: 2392.5,
    paid: 892.5,
    due: 1500,
    status: 'partial',
    paymentIds: ['pay_35tperctcuf576w6l4i3j'],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    vendor: { id: TEST_STOCK_VENDOR_ID, name: 'Ankur Pharma', phone: '+919876500011' },
    ...overrides,
  };
}

/** A Movements row: the use, with its item and author. */
export function stockMovementRow(
  overrides: Partial<StockMovementRow> = {},
): StockMovementRow {
  return {
    id: TEST_STOCK_MOVEMENT_ID,
    itemId: TEST_STOCK_ITEM_ID,
    kind: 'used',
    deltaMilli: -500,
    afterMilli: 2500,
    usedFor: 'LHR · Dharti Galani',
    note: null,
    patientTreatmentId: null,
    purchaseId: null,
    stockCountId: null,
    revertsId: null,
    revertedById: null,
    revertReason: null,
    authorId: TEST_STOCK_AUTHOR_ID,
    createdAt: '2026-10-10T05:35:00.000Z',
    item: {
      id: TEST_STOCK_ITEM_ID,
      name: 'Soframycin 30 gm',
      unit: 'tube',
      sizePerUnit: 30_000,
      measureUnit: 'g',
    },
    by: { id: TEST_STOCK_AUTHOR_ID, name: 'Dr. Nisha Shah', initials: 'NS', tone: 'sky' },
    reverted: false,
    reverts: null,
    purchase: null,
    ...overrides,
  };
}
