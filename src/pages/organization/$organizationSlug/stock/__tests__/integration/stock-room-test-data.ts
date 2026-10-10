import { vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import {
  stockItemRow,
  stockMovementRow,
  stockPurchaseRow,
  stockVendorRow,
  TEST_STOCK_PURCHASE_ID,
} from '@/tests/utils/stock-doubles.ts';

import type { StockSummaryTab } from '../../shared/stock-api.ts';
import {
  fetchAllStockItems,
  fetchAllStockVendors,
  fetchStockItem,
  fetchStockPurchase,
  fetchStockVendor,
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
  stockListSummary,
} from '../../shared/stock-api.ts';
import type {
  StockItemRow,
  StockListSummary,
  StockMovementRow,
  StockPurchaseRow,
  StockVendorRow,
} from '../../shared/stock-contracts.ts';

/** The room's URL in the harness's organization. */
export const STOCK_ROOM_URL = '/organization/acme/stock';

// Public ids as the URL takes them (`<prefix>_<21 [a-z0-9]>`).
const MASK_ID = 'sitm_dtanmask0000000000000';
const COTTON_ID = 'sitm_cottonroll00000000000';
const UNPAID_ID = 'spur_billfifteen0000000000';
const CRANIX_ID = 'svnd_cranix000000000000000';
const IBREIA_ID = 'svnd_ibreia000000000000000';
const RECEIPT_ID = 'smov_receipt00000000000000';

/** Soframycin (3 tubes, OK), D-Tan Mask (low, a week left) and an empty Cotton roll. */
const STOCK_ITEM_ROWS: StockItemRow[] = [
  stockItemRow(),
  stockItemRow({
    id: MASK_ID,
    seq: 161,
    name: 'D-Tan Mask',
    category: 'masks',
    unit: 'piece',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 1000,
    minQty: 2,
    maxQty: 10,
    usagePerWeekMilli: 1000,
    level: 'low',
    lastsDays: 7,
    vendorId: CRANIX_ID,
    vendor: { id: CRANIX_ID, name: 'Cranix Pharma', phone: null },
  }),
  stockItemRow({
    id: COTTON_ID,
    seq: 170,
    name: 'Cotton roll',
    category: 'consumables',
    unit: 'roll',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 0,
    usagePerWeekMilli: 0,
    level: 'out',
    lastsDays: null,
    vendorId: null,
    vendor: null,
  }),
];

/** Bill #16 from Ankur Pharma, partly paid, and #15 from Cranix Pharma, nothing paid. */
const STOCK_PURCHASE_ROWS: StockPurchaseRow[] = [
  stockPurchaseRow(),
  stockPurchaseRow({
    id: UNPAID_ID,
    seq: 15,
    vendorId: CRANIX_ID,
    billNo: 'CX-118',
    bill: 1710,
    paid: 0,
    due: 1710,
    status: 'unpaid',
    paymentIds: [],
    vendor: { id: CRANIX_ID, name: 'Cranix Pharma', phone: null },
  }),
];

/** Half a tube of Soframycin used for an LHR, and the five received on bill #16. */
const STOCK_MOVEMENT_ROWS: StockMovementRow[] = [
  stockMovementRow(),
  stockMovementRow({
    id: RECEIPT_ID,
    kind: 'received',
    deltaMilli: 5000,
    afterMilli: 3000,
    usedFor: null,
    purchaseId: TEST_STOCK_PURCHASE_ID,
    purchase: { id: TEST_STOCK_PURCHASE_ID, seq: 16, billNo: 'INV-221' },
    createdAt: '2026-10-09T09:00:00.000Z',
  }),
];

/** Ankur Pharma, owed ₹1,500 over two purchases; Cranix Pharma owed ₹1,710; Ibreia, nothing. */
const STOCK_VENDOR_ROWS: StockVendorRow[] = [
  stockVendorRow(),
  stockVendorRow({
    id: CRANIX_ID,
    name: 'Cranix Pharma',
    phone: null,
    payable: 1710,
    purchaseCount: 1,
  }),
  stockVendorRow({
    id: IBREIA_ID,
    name: 'Ibreia',
    phone: '+918238450007',
    payable: 0,
    purchaseCount: 0,
  }),
];

/** Each tab's footer as the API's one-row reads answer it. */
const SUMMARIES: Record<StockSummaryTab, StockListSummary> = {
  purchases: { total: 2, due: 3210 },
  movements: { total: 2, due: null },
  vendors: { total: 3, due: 3210 },
};

/**
 * What a member of a narrow role holds: Therapist's and Front desk's stock codes without
 * `payment:create` (see, add, change and move stock — no delete, no export, no Paid), and a
 * member who may only look.
 */
export const STOCK_NARROW_CODES = {
  keeper: [
    'organization:read',
    'stock_item:read',
    'stock_item:create',
    'stock_item:update',
  ],
  viewer: ['organization:read', 'stock_item:read'],
} as const satisfies Record<string, readonly OrganizationPermission[]>;

/**
 * Answer every read the room makes from the rows above — the four lists, their footers, the
 * item and vendor catalogues and each record by id. The test file mocks `stock-api.ts`
 * (`vi.mock`, every function below a `vi.fn()`); this primes those mocks.
 */
export function primeStockRoom() {
  const byId =
    <T extends { id: string }>(rows: readonly T[]) =>
    async (id: string) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) throw new Error(`no record ${id}`);
      return row;
    };
  vi.mocked(listStockItems).mockResolvedValue({
    rows: STOCK_ITEM_ROWS,
    next: null,
    total: STOCK_ITEM_ROWS.length,
  });
  vi.mocked(listStockPurchases).mockResolvedValue({
    rows: STOCK_PURCHASE_ROWS,
    next: null,
    total: STOCK_PURCHASE_ROWS.length,
  });
  vi.mocked(listStockMovements).mockResolvedValue({
    rows: STOCK_MOVEMENT_ROWS,
    next: null,
    total: STOCK_MOVEMENT_ROWS.length,
  });
  vi.mocked(listStockVendors).mockResolvedValue({
    rows: STOCK_VENDOR_ROWS,
    next: null,
    total: STOCK_VENDOR_ROWS.length,
  });
  vi.mocked(stockListSummary).mockImplementation(async (tab) => SUMMARIES[tab]);
  vi.mocked(fetchAllStockItems).mockResolvedValue(STOCK_ITEM_ROWS);
  vi.mocked(fetchAllStockVendors).mockResolvedValue(STOCK_VENDOR_ROWS);
  vi.mocked(fetchStockItem).mockImplementation(byId(STOCK_ITEM_ROWS));
  vi.mocked(fetchStockPurchase).mockImplementation(byId(STOCK_PURCHASE_ROWS));
  vi.mocked(fetchStockVendor).mockImplementation(byId(STOCK_VENDOR_ROWS));
}
