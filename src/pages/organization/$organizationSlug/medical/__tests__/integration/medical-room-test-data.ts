import { vi } from 'vitest';

import { fetchStoreCreditCount, listStoreCredits } from '@/shared/api/app/credits-api.ts';
import {
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
} from '@/shared/api/app/medicines-api.ts';
import type { MedicineRow } from '@/shared/api/app/medicines-contracts.ts';
import { listStoreLedger } from '@/shared/api/app/payments-api.ts';
import {
  manufacturerRow,
  medicalPage,
  medicineRow,
  mrRow,
  mrVisitRow,
  paidSaleRow,
  prescriptionToFill,
  purchaseOrderRow,
  saleRow,
  supplierCreditRow,
  supplierRow,
  TEST_BUYER_CONTACT_ID,
  TEST_MEDICINE_ID,
  TEST_PURCHASE_ORDER_ITEM_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';
import { creditRow, ledgerRow } from '@/tests/utils/payments-doubles.ts';

import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchManufacturer,
  fetchMedicalRep,
  fetchMedicalSale,
  fetchMrVisits,
  fetchOldestOpenPurchaseOrder,
  fetchPurchaseOrder,
  fetchSupplier,
  fetchSupplierAccount,
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPrescriptionsToFill,
  listPurchaseOrders,
  listSaleReminders,
  listSupplierCredits,
  listSuppliers,
  medicalListSummary,
  type MedicalSummaryTab,
} from '../../shared/medical-api.ts';
import type {
  ManufacturerRow,
  MedicalListSummary,
  MrRow,
  PurchaseOrderRow,
  SaleRow,
  SupplierCreditRow,
  SupplierRow,
} from '../../shared/medical-contracts.ts';
import type { MedicalTestTab } from './medical-test-router.tsx';

/** The room's URL in the harness's organization. */
export const MEDICAL_ROOM_URL = '/organization/acme/medical';

/** 10:00 on 10 Oct, clinic time — the day every row's "when" and expiry is read on. */
export const MEDICAL_ROOM_NOW = new Date('2026-10-10T04:30:00Z');

// Public ids as the URL takes them (`<prefix>_<21 [a-z0-9]>`).
export const PAID_SALE_ID = 'msal_sale98300000000000000';
const RETURNED_SALE_ID = 'msal_sale97100000000000000';
const GLYCOLAC_ID = 'med_glyco0000000000000000';
export const TRICHOSPIRE_ID = 'med_trichospire0000000000';
export const ORDERED_ORDER_ID = 'mpo_order4300000000000000';
const PAID_ORDER_ID = 'mpo_order4280000000000000';
export const NH_PHARMA_ID = 'sup_nhpharma00000000000000';
const AKSHAR_ID = 'sup_akshar000000000000000';
export const ZEN_ID = 'mfr_zen000000000000000000';
export const RAKESH_ID = 'mrep_rakesh000000000000000';
const SETTLED_PAYMENT_ID = 'pay_settled0000000000000';
const ADJUSTED_CREDIT_ID = 'scr_adjusted0000000000000';

// ── Sales ──

/** #978 to Priya Shah, unpaid; #983 to Rhea Shah, paid in full; #971 to Meera Joshi, partly returned. */
export const UNPAID_SALE: SaleRow = saleRow();
export const PAID_SALE: SaleRow = paidSaleRow({
  id: PAID_SALE_ID,
  seq: 983,
  customer: {
    id: 'con_rhea00000000000000000',
    name: 'Rhea Shah',
    phone: '+919825044120',
    patientId: 'pat_rhea00000000000000000',
  },
});
const RETURNED_SALE: SaleRow = paidSaleRow({
  id: RETURNED_SALE_ID,
  seq: 971,
  status: 'returned',
  returned: 650,
  customer: {
    id: 'con_meera0000000000000000',
    name: 'Meera Joshi',
    phone: null,
    patientId: null,
  },
});
export const SALE_ROWS: SaleRow[] = [PAID_SALE, UNPAID_SALE, RETURNED_SALE];

// ── Medicines ──

/** Azelaic gel, 12 in stock to 12/27; Glycolac Cream, low, its batch out in 20 days; Trichospire, none left. */
export const AZELAIC: MedicineRow = medicineRow();
const GLYCOLAC: MedicineRow = medicineRow({
  id: GLYCOLAC_ID,
  seq: 456,
  name: 'Glycolac Cream',
  composition: 'Glycolic acid 6%',
  mrp: 162.5,
  stock: 3,
  stockLevel: 'low',
  nearest: { batchNo: '026-298', expiry: '10/26', daysLeft: 20 },
  margin: 24.31,
  batches: [
    {
      id: 'mbt_glyco0260000000000000',
      batchNo: '026-298',
      expiry: '10/26',
      qty: 3,
      purchaseRate: 123,
      supplierId: TEST_SUPPLIER_ID,
      expired: false,
    },
  ],
});
const TRICHOSPIRE: MedicineRow = medicineRow({
  id: TRICHOSPIRE_ID,
  seq: 461,
  name: 'Trichospire Hair Kit',
  composition: 'Biotin, peptides',
  mrp: 1450,
  stock: 0,
  stockLevel: 'out',
  nearest: null,
  margin: 28.4,
  batches: [],
});
const MEDICINE_ROWS: MedicineRow[] = [AZELAIC, GLYCOLAC, TRICHOSPIRE];

// ── Purchase orders ──

/** #431 received from Ankur Pharma, ₹827 due; #430 Ordered from NH Pharma; #428 paid to Akshar Medicines. */
const RECEIVED_ORDER: PurchaseOrderRow = purchaseOrderRow();
export const ORDERED_ORDER: PurchaseOrderRow = purchaseOrderRow({
  id: ORDERED_ORDER_ID,
  seq: 430,
  stage: 'ordered',
  apiStage: 'ordered',
  receivedAt: null,
  supplier: { id: NH_PHARMA_ID, name: 'NH Pharma', phone: null, gstNumber: null },
  supplierBillNo: null,
  lines: [
    {
      id: TEST_PURCHASE_ORDER_ITEM_ID,
      lineNo: 1,
      medicineId: TEST_MEDICINE_ID,
      medicineName: 'Azelaic gel 15g',
      qty: 10,
      free: 1,
      rate: 423.6,
      amount: 4236,
      received: null,
      batchNo: null,
      expiry: null,
    },
  ],
  paid: 0,
  due: 0,
  paymentStatus: 'unpaid',
});
const PAID_ORDER: PurchaseOrderRow = purchaseOrderRow({
  id: PAID_ORDER_ID,
  seq: 428,
  stage: 'paid',
  supplier: { id: AKSHAR_ID, name: 'Akshar Medicines', phone: null, gstNumber: null },
  supplierBillNo: 'AK-1631',
  total: 1296,
  paid: 1296,
  due: 0,
  paymentStatus: 'paid',
});
const PURCHASE_ORDER_ROWS: PurchaseOrderRow[] = [
  RECEIVED_ORDER,
  ORDERED_ORDER,
  PAID_ORDER,
];

// ── Suppliers, manufacturers and MRs ──

/** Ankur Pharma, owed ₹827 for 5 days; NH Pharma and Akshar Medicines, owed nothing — Akshar with no phone. */
const ANKUR: SupplierRow = supplierRow();
export const NH_PHARMA: SupplierRow = supplierRow({
  id: NH_PHARMA_ID,
  name: 'NH Pharma',
  phone: '+918238450007',
  gstNumber: null,
  payable: 0,
  ageingDays: null,
  orderCount: 1,
  orderTotal: 4236,
});
const AKSHAR: SupplierRow = supplierRow({
  id: AKSHAR_ID,
  name: 'Akshar Medicines',
  phone: null,
  gstNumber: null,
  manufacturers: [],
  manufacturerIds: [],
  payable: 0,
  ageingDays: null,
  orderCount: 1,
  orderTotal: 1296,
});
const SUPPLIER_ROWS: SupplierRow[] = [ANKUR, NH_PHARMA, AKSHAR];

/** SUN PHARMA with 14 medicines, its supplier and MR; ZEN, quick-added, nothing linked yet. */
export const SUN_PHARMA: ManufacturerRow = manufacturerRow();
const ZEN: ManufacturerRow = manufacturerRow({
  id: ZEN_ID,
  name: 'ZEN',
  tone: 'mint',
  isQuick: true,
  medicineCount: 0,
  suppliers: [],
  mrs: [],
});
const MANUFACTURER_ROWS: ManufacturerRow[] = [SUN_PHARMA, ZEN];

/** Rahul Mehta for SUN PHARMA; Alvio Pharma · Rakesh, no phone, his visit overdue. */
const RAHUL: MrRow = mrRow();
export const RAKESH: MrRow = mrRow({
  id: RAKESH_ID,
  name: 'Alvio Pharma · Rakesh',
  phone: null,
  nextVisitOn: '2026-09-01',
  visitOverdue: true,
  manufacturers: [],
  manufacturerIds: [],
});
const MR_ROWS: MrRow[] = [RAHUL, RAKESH];

// ── Money ──

/** The store's receipt on sale #978 from Priya Shah, an open day's; a Medicines expense to Ankur Pharma on a closed day. */
const LEDGER_ROWS = [
  ledgerRow({
    partyName: 'Priya Shah',
    contact: { id: TEST_BUYER_CONTACT_ID, name: 'Priya Shah', phone: '+919900011122' },
  }),
  ledgerRow({
    id: SETTLED_PAYMENT_ID,
    seq: 6,
    direction: 'paid',
    kind: 'expense',
    partyName: 'Ankur Pharma',
    payeeName: 'Ankur Pharma',
    expenseCategory: 'medicines',
    invoiceId: null,
    invoice: null,
    isSettled: true,
    editCount: 0,
    lastEdit: null,
  }),
];

/** Two tubes of batch 026-312 back to Ankur Pharma, open; batch 026-298's credit, applied to its dues. */
const SUPPLIER_CREDIT_ROWS: SupplierCreditRow[] = [
  supplierCreditRow(),
  supplierCreditRow({
    id: ADJUSTED_CREDIT_ID,
    batchNo: '026-298',
    applied: 840,
    status: 'adjusted',
  }),
];

/** What the store owes Priya Shah from a return kept as store credit. */
const STORE_CREDIT_ROWS = [
  creditRow({
    partyName: 'Priya Shah',
    contact: { id: TEST_BUYER_CONTACT_ID, name: 'Priya Shah', phone: '+919900011122' },
    direction: 'give',
    status: 'open',
  }),
];

/** How many rows each tab's read answers. */
export const MEDICAL_ROW_COUNTS: Record<MedicalTestTab, number> = {
  sales: SALE_ROWS.length,
  medicines: MEDICINE_ROWS.length,
  purchases: PURCHASE_ORDER_ROWS.length,
  suppliers: SUPPLIER_ROWS.length,
  manufacturers: MANUFACTURER_ROWS.length,
  mrs: MR_ROWS.length,
  payments: LEDGER_ROWS.length,
  credits: SUPPLIER_CREDIT_ROWS.length,
};

/** Each tab's footer as the API's one-row reads answer it. */
const SUMMARIES: Record<MedicalSummaryTab, MedicalListSummary> = {
  sales: { total: SALE_ROWS.length, payable: 0 },
  purchases: { total: PURCHASE_ORDER_ROWS.length, payable: 0 },
  suppliers: { total: SUPPLIER_ROWS.length, payable: 827 },
  manufacturers: { total: MANUFACTURER_ROWS.length, payable: 0 },
  mrs: { total: MR_ROWS.length, payable: 0 },
  supplierCredits: { total: SUPPLIER_CREDIT_ROWS.length, payable: 0 },
};

/** A record read by id over `rows` — an unknown id fails as the API's 404 would. */
const byId =
  <T extends { id: string }>(rows: readonly T[]) =>
  async (id: string): Promise<T> => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`no record ${id}`);
    return row;
  };

/**
 * Answer every read the Medical room makes from the rows above — the eight tabs' lists, their
 * footers, the catalogues the pickers and Filters read, each record by id, a supplier's Account,
 * an MR's visits, the pharmacy queue and the dues. The test file mocks `medical-api.ts`,
 * `medicines-api.ts`, `payments-api.ts` and `credits-api.ts` (`vi.mock`, every read below a
 * `vi.fn()`); this primes those mocks.
 */
export function primeMedicalRoom() {
  vi.mocked(listMedicalSales).mockResolvedValue(medicalPage(SALE_ROWS));
  vi.mocked(fetchMedicalSale).mockImplementation(byId(SALE_ROWS));
  vi.mocked(listSaleReminders).mockResolvedValue({
    clinicName: 'Cresence Skin',
    customers: [],
  });
  vi.mocked(listPrescriptionsToFill).mockResolvedValue([prescriptionToFill()]);

  vi.mocked(listMedicines).mockResolvedValue(medicalPage(MEDICINE_ROWS));
  vi.mocked(fetchAllMedicines).mockResolvedValue(MEDICINE_ROWS);
  vi.mocked(fetchMedicine).mockImplementation(byId(MEDICINE_ROWS));

  vi.mocked(listPurchaseOrders).mockResolvedValue(medicalPage(PURCHASE_ORDER_ROWS));
  vi.mocked(fetchPurchaseOrder).mockImplementation(byId(PURCHASE_ORDER_ROWS));
  vi.mocked(fetchOldestOpenPurchaseOrder).mockResolvedValue(RECEIVED_ORDER);

  vi.mocked(listSuppliers).mockResolvedValue(medicalPage(SUPPLIER_ROWS));
  vi.mocked(fetchAllSuppliers).mockResolvedValue(SUPPLIER_ROWS);
  vi.mocked(fetchSupplier).mockImplementation(byId(SUPPLIER_ROWS));
  vi.mocked(fetchSupplierAccount).mockResolvedValue([]);
  vi.mocked(listSupplierCredits).mockResolvedValue(medicalPage(SUPPLIER_CREDIT_ROWS));

  vi.mocked(listManufacturers).mockResolvedValue(medicalPage(MANUFACTURER_ROWS));
  vi.mocked(fetchAllManufacturers).mockResolvedValue(MANUFACTURER_ROWS);
  vi.mocked(fetchManufacturer).mockImplementation(byId(MANUFACTURER_ROWS));

  vi.mocked(listMedicalReps).mockResolvedValue(medicalPage(MR_ROWS));
  vi.mocked(fetchAllMedicalReps).mockResolvedValue(MR_ROWS);
  vi.mocked(fetchMedicalRep).mockImplementation(byId(MR_ROWS));
  vi.mocked(fetchMrVisits).mockResolvedValue([mrVisitRow()]);

  vi.mocked(medicalListSummary).mockImplementation(async (tab) => SUMMARIES[tab]);

  vi.mocked(listStoreLedger).mockResolvedValue(medicalPage(LEDGER_ROWS));
  vi.mocked(listStoreCredits).mockResolvedValue(medicalPage(STORE_CREDIT_ROWS));
  vi.mocked(fetchStoreCreditCount).mockResolvedValue(STORE_CREDIT_ROWS.length);
}
