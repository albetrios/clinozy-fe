import { createdFilterMatches } from '@/shared/api/clinic/clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CursorPage,
  cursorPageOf,
  directedCompare,
  searchMatches,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import type { StockItem, StockVendor } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';

import type {
  StockChangeRow,
  StockItemListParams,
  StockItemRow,
  StockListSummary,
  StockMovementListParams,
  StockMovementRow,
  StockPurchaseListParams,
  StockPurchaseRow,
  StockStaffRef,
  StockVendorListParams,
  StockVendorRef,
  StockVendorRow,
} from './stock-contracts.ts';
import {
  lastsDays,
  purchaseStatus,
  runwayKey,
  runwayOf,
  STOCK_MOVEMENT_TONES,
  stockLevel,
  type StockMovementKind,
  type StockPurchaseStatus,
} from './stock-units.ts';

/*
 * The Clinic stock family's reads (`S:1680–1693`), on the fixture world until
 * clinozy-be serves them — every call is REPLACE_WITH_API (D6). The world is
 * imported on demand, so its seed data never lands in a route chunk. Each row
 * carries what the server derives (Appendix F): the level and runway, a
 * purchase's due and status, the Movements' payment rows and a vendor's
 * payable.
 */

/** TanStack Query keys for Clinic stock — all under `['clinic', 'stock']`. */
export const stockQueryKeys = {
  all: ['clinic', 'stock'] as const,
  items: (params: StockItemListParams) =>
    [...stockQueryKeys.all, 'items', params] as const,
  item: (id: string) => [...stockQueryKeys.all, 'item', id] as const,
  purchases: (params: StockPurchaseListParams) =>
    [...stockQueryKeys.all, 'purchases', params] as const,
  purchase: (id: string) => [...stockQueryKeys.all, 'purchase', id] as const,
  movements: (params: StockMovementListParams) =>
    [...stockQueryKeys.all, 'movements', params] as const,
  vendors: (params: StockVendorListParams) =>
    [...stockQueryKeys.all, 'vendors', params] as const,
  vendor: (id: string) => [...stockQueryKeys.all, 'vendor', id] as const,
  /** A list's footer figures, by tab and params. */
  summary: (tab: StockSummaryTab, params: object) =>
    [...stockQueryKeys.all, 'summary', tab, params] as const,
  /** A tab's automatic Filters sections — the values its whole list holds. */
  facets: (tab: StockFacetTab) => [...stockQueryKeys.all, 'facets', tab] as const,
  /** A whole list the pickers, chips and Stock check read. */
  catalogue: (kind: 'items' | 'vendors') =>
    [...stockQueryKeys.all, 'catalogue', kind] as const,
};

const fixtureWorld = () => import('@/shared/api/clinic/fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/** Whether `createdAt` passes the Created filter (none set passes). */
function createdOk(createdAt: string, created: CreatedFilter | undefined, today: string) {
  return !created || createdFilterMatches(createdAt, created, today);
}

/** A category as the search reads it: `creams_serums` → "creams serums". */
const categoryWords = (item: StockItem) => item.category.replace('_', ' ');

/** Every live vendor as a row names them. */
function vendorRefs(world: FixtureWorld): Map<string, StockVendorRef> {
  return new Map(
    world.stockVendors
      .snapshot()
      .map((vendor) => [
        vendor.id,
        { id: vendor.id, name: vendor.name, phone: vendor.phone },
      ]),
  );
}

/** Every member as the Movements "By" cell shows them. */
function staffRefs(world: FixtureWorld): Map<string, StockStaffRef> {
  return new Map(
    world.staff.snapshot().map((profile) => [
      profile.id,
      {
        id: profile.id,
        name: personFullName(profile),
        initials: profile.initials,
        tone: profile.tone,
      },
    ]),
  );
}

// ── Items ──

/** An item as its row: its vendor, its level and how many days it lasts. */
function toItemRow(item: StockItem, vendors: Map<string, StockVendorRef>): StockItemRow {
  return {
    ...item,
    vendor: item.vendorId ? (vendors.get(item.vendorId) ?? null) : null,
    level: stockLevel(item.qtyMilli, item.minQty),
    lastsDays: lastsDays(item.qtyMilli, item.usagePerWeekMilli),
  };
}

/** Every live item as its row. */
function itemRows(world: FixtureWorld): StockItemRow[] {
  const vendors = vendorRefs(world);
  return world.stockItems.snapshot().map((item) => toItemRow(item, vendors));
}

/** No usage sorts after every runway. */
const lastsRank = (row: StockItemRow) => row.lastsDays ?? Number.POSITIVE_INFINITY;

const ITEM_ORDER = {
  seq: (a: StockItemRow, b: StockItemRow) => a.seq - b.seq,
  name: (a: StockItemRow, b: StockItemRow) => a.name.localeCompare(b.name),
  category: (a: StockItemRow, b: StockItemRow) => compareText(a.category, b.category),
  stock: (a: StockItemRow, b: StockItemRow) => a.qtyMilli - b.qtyMilli,
  lasts: (a: StockItemRow, b: StockItemRow) => {
    const left = lastsRank(a);
    const right = lastsRank(b);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  },
};

/** The items a list read matches, in its order (name, A to Z, by default — `S:1681`). */
async function itemsFor(params: StockItemListParams): Promise<StockItemRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  return itemRows(clinicFixtures)
    .filter(
      (row) =>
        searchMatches(params.q, [row.name, categoryWords(row), row.vendor?.name ?? '']) &&
        (params.stock !== 'low' || row.level !== 'ok') &&
        (!params.category?.length || params.category.includes(row.category)) &&
        (!params.lasts?.length ||
          params.lasts.includes(runwayKey(runwayOf(row.lastsDays)))) &&
        createdOk(row.createdAt, params.created, today),
    )
    .sort(
      (a, b) =>
        directedCompare(ITEM_ORDER[params.sort ?? 'name'], params.order)(a, b) ||
        b.seq - a.seq,
    );
}

/** One cursor page of items (`listStockItems`, `S:1681`; REPLACE_WITH_API). */
export async function listStockItems(
  params: StockItemListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<StockItemRow>> {
  return cursorPageOf(await itemsFor(params), cursor);
}

/** Every live item as its row, in inventory order (the latest first) — the pickers and Stock check. */
export async function fetchAllStockItems(): Promise<StockItemRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  return itemRows(clinicFixtures).sort((a, b) => b.seq - a.seq);
}

/** One item as its row — a 404 when it is unknown or deleted. */
export async function fetchStockItem(id: string): Promise<StockItemRow> {
  const { clinicFixtures } = await fixtureWorld();
  const item = await clinicFixtures.stockItems.get(id);
  return toItemRow(item, vendorRefs(clinicFixtures));
}

// ── Purchases ──

/** Every live purchase as its row: its vendor, what is due and its status. */
function purchaseRows(world: FixtureWorld): StockPurchaseRow[] {
  const vendors = vendorRefs(world);
  return world.stockPurchases.snapshot().map((purchase) => ({
    ...purchase,
    vendor: vendors.get(purchase.vendorId) ?? null,
    due: Math.max(0, purchase.bill - purchase.paid),
    status: purchaseStatus(purchase.bill, purchase.paid),
  }));
}

const PURCHASE_ORDER = {
  seq: (a: StockPurchaseRow, b: StockPurchaseRow) => a.seq - b.seq,
  vendor: (a: StockPurchaseRow, b: StockPurchaseRow) =>
    (a.vendor?.name ?? '').localeCompare(b.vendor?.name ?? ''),
  bill: (a: StockPurchaseRow, b: StockPurchaseRow) => a.bill - b.bill,
  due: (a: StockPurchaseRow, b: StockPurchaseRow) => a.due - b.due,
};

/** The purchases a list read matches, in its order (the latest bill first — `S:1683`). */
async function purchasesFor(
  params: StockPurchaseListParams,
): Promise<StockPurchaseRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const rows = purchaseRows(clinicFixtures).filter(
    (row) =>
      searchMatches(params.q, [
        row.vendor?.name ?? '',
        row.billNo ?? '',
        `#${row.seq}`,
      ]) &&
      (!params.status?.length || params.status.includes(row.status)) &&
      (!params.vendor || row.vendorId === params.vendor) &&
      createdOk(row.createdAt, params.created, today),
  );
  return rows.sort((a, b) =>
    params.sort
      ? directedCompare(PURCHASE_ORDER[params.sort], params.order)(a, b) || b.seq - a.seq
      : compareText(b.date, a.date) || b.seq - a.seq,
  );
}

/** One cursor page of purchases (`listStockPurchases`, `S:1683`; REPLACE_WITH_API). */
export async function listStockPurchases(
  params: StockPurchaseListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<StockPurchaseRow>> {
  return cursorPageOf(await purchasesFor(params), cursor);
}

/** One purchase as its row — a 404 when it is unknown or deleted. */
export async function fetchStockPurchase(id: string): Promise<StockPurchaseRow> {
  const { clinicFixtures } = await fixtureWorld();
  const [row] = purchaseRows(clinicFixtures).filter((purchase) => purchase.id === id);
  if (!row) throw clinicHttpError(404, 'not_found', 'Purchase not found');
  return row;
}

// ── Movements ──

/** A Movements row's instant, for the newest-first order and the Created filter. */
const rowInstant = (row: StockMovementRow) =>
  row.kind === 'payment' ? row.createdAt : row.at;

/**
 * Every Movements row: each live movement — struck through once a later one
 * reverts it — and one Payment per purchase with money paid
 * (`clinic-stock.md:71`), derived until `listMovements` serves them
 * (Appendix F), by the member who recorded the purchase.
 */
function movementRows(world: FixtureWorld): StockMovementRow[] {
  const staff = staffRefs(world);
  const items = new Map(world.stockItems.snapshot().map((item) => [item.id, item]));
  const vendors = vendorRefs(world);
  const all = world.stockMovements.snapshot();
  const byId = new Map(all.map((movement) => [movement.id, movement]));
  const movements = all.flatMap((movement) => {
    const item = items.get(movement.itemId);
    if (!item) return [];
    const original = movement.revertsId ? byId.get(movement.revertsId) : undefined;
    return [
      {
        id: movement.id,
        kind: movement.type,
        movement,
        item: {
          id: item.id,
          name: item.name,
          unit: item.unit,
          sizePerUnit: item.sizePerUnit,
          measureUnit: item.measureUnit,
        },
        note: movement.usedFor,
        at: movement.createdAt,
        by: staff.get(movement.createdById) ?? null,
        deltaMilli: movement.deltaMilli,
        reverted: movement.revertedById !== null,
        reverts:
          original && original.type !== 'reverted'
            ? {
                kind: original.type,
                at: original.createdAt,
                reason: movement.revertReason,
              }
            : null,
      } satisfies StockChangeRow,
    ];
  });
  const payments = world.stockPurchases
    .snapshot((purchase) => purchase.paid > 0)
    .map(
      (purchase) =>
        ({
          id: `payment-${purchase.id}`,
          kind: 'payment',
          purchase: { id: purchase.id, seq: purchase.seq, billNo: purchase.billNo },
          vendorName: vendors.get(purchase.vendorId)?.name ?? '',
          date: purchase.date,
          createdAt: purchase.createdAt,
          by: staff.get(purchase.createdById) ?? null,
          amount: purchase.paid,
        }) satisfies StockMovementRow,
    );
  return [...movements, ...payments];
}

/** A row's searchable words: the item or party and its note or bill. */
function movementWords(row: StockMovementRow): string[] {
  if (row.kind === 'payment') {
    return [row.vendorName, `#${row.purchase.seq}`, row.purchase.billNo ?? ''];
  }
  return [row.item.name, row.note ?? ''];
}

/** The rows a Movements read matches, newest first (`S:1682`). */
async function movementsFor(
  params: StockMovementListParams,
): Promise<StockMovementRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  return movementRows(clinicFixtures)
    .filter(
      (row) =>
        searchMatches(params.q, movementWords(row)) &&
        (!params.type?.length || params.type.includes(row.kind)) &&
        (!params.item || (row.kind !== 'payment' && row.item.id === params.item)) &&
        createdOk(rowInstant(row), params.created, today),
    )
    .sort((a, b) => compareText(rowInstant(b), rowInstant(a)) || compareText(b.id, a.id));
}

/** One cursor page of Movements rows (`listMovements`, `S:1682`; REPLACE_WITH_API). */
export async function listStockMovements(
  params: StockMovementListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<StockMovementRow>> {
  return cursorPageOf(await movementsFor(params), cursor);
}

// ── Vendors ──

/** Every live vendor as their row (Q-K1): their purchases and what they are owed. */
function vendorRows(world: FixtureWorld): StockVendorRow[] {
  const purchases = purchaseRows(world);
  return world.stockVendors.snapshot().map((vendor: StockVendor) => {
    const own = purchases.filter((purchase) => purchase.vendorId === vendor.id);
    const [oldest] = own
      .filter((purchase) => purchase.due > 0)
      .sort((a, b) => compareText(a.date, b.date) || a.seq - b.seq);
    return {
      ...vendor,
      purchaseCount: own.length,
      payable: own.reduce((sum, purchase) => sum + purchase.due, 0),
      oldestOpenPurchase: oldest
        ? { id: oldest.id, seq: oldest.seq, due: oldest.due }
        : null,
    };
  });
}

const VENDOR_ORDER = {
  name: (a: StockVendorRow, b: StockVendorRow) => a.name.localeCompare(b.name),
  payable: (a: StockVendorRow, b: StockVendorRow) => a.payable - b.payable,
};

/** The vendors a list read matches, in its order (name, A to Z, by default — `S:1684`). */
async function vendorsFor(params: StockVendorListParams): Promise<StockVendorRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  return vendorRows(clinicFixtures)
    .filter((row) => searchMatches(params.q, [row.name, row.phone ?? '']))
    .sort(directedCompare(VENDOR_ORDER[params.sort ?? 'name'], params.order));
}

/** One cursor page of vendors (`listVendors`, `S:1684`; REPLACE_WITH_API). */
export async function listStockVendors(
  params: StockVendorListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<StockVendorRow>> {
  return cursorPageOf(await vendorsFor(params), cursor);
}

/** Every live vendor as their row, by name — the pickers' list. */
export function fetchAllStockVendors(): Promise<StockVendorRow[]> {
  return vendorsFor({});
}

/** One vendor as their row — a 404 when they are unknown or deleted. */
export async function fetchStockVendor(id: string): Promise<StockVendorRow> {
  const { clinicFixtures } = await fixtureWorld();
  const [row] = vendorRows(clinicFixtures).filter((vendor) => vendor.id === id);
  if (!row) throw clinicHttpError(404, 'not_found', 'Vendor not found');
  return row;
}

// ── Footer figures and Filters ──

/** A tab with footer figures (Items has none, `clinic-stock.md:19`). */
export type StockSummaryTab = 'purchases' | 'movements' | 'vendors';

/**
 * A list's footer figures (`clinic-stock.md:19`): how many rows the read
 * matches and, on Purchases and Vendors, what is due on them — a fixture
 * `total` until the list contract carries one (C31, Appendix F;
 * REPLACE_WITH_API).
 */
export async function stockListSummary(
  tab: StockSummaryTab,
  params: object,
): Promise<StockListSummary> {
  switch (tab) {
    case 'purchases': {
      const rows = await purchasesFor(params);
      return { total: rows.length, due: rows.reduce((sum, row) => sum + row.due, 0) };
    }
    case 'vendors': {
      const rows = await vendorsFor(params);
      return { total: rows.length, due: rows.reduce((sum, row) => sum + row.payable, 0) };
    }
    default:
      return { total: (await movementsFor(params)).length, due: 0 };
  }
}

/** A tab with automatic Filters sections. */
export type StockFacetTab = 'items' | 'purchases' | 'movements';

/**
 * A tab's automatic Filters sections (`clinic-stock.md:39–71`): the values
 * its whole list holds — Items' categories and runways, Purchases' statuses,
 * Movements' types — in display order, and how many rows it holds, for the
 * "2–10 values, fewer than rows" rule (REPLACE_WITH_API).
 */
export interface StockFacets {
  rows: number;
  values: Readonly<Record<string, readonly string[]>>;
}

/** The runway keys present, shortest first, No usage last. */
function runwayKeys(rows: readonly StockItemRow[]): string[] {
  const byKey = new Map<string, number>();
  for (const row of rows) {
    byKey.set(runwayKey(runwayOf(row.lastsDays)), lastsRank(row));
  }
  return [...byKey.entries()]
    .sort(([, left], [, right]) => {
      if (left === right) return 0;
      return left < right ? -1 : 1;
    })
    .map(([key]) => key);
}

/** The values present in `rows`, in `order`. */
const presentIn = <T extends string>(order: readonly T[], present: readonly T[]) =>
  order.filter((value) => present.includes(value));

const CATEGORY_ORDER = [
  'creams_serums',
  'peels',
  'masks',
  'consumables',
  'equipment',
  'other',
] as const satisfies readonly StockItem['category'][];

const STATUS_ORDER: readonly StockPurchaseStatus[] = ['paid', 'partly', 'unpaid'];

const MOVEMENT_ORDER = Object.keys(STOCK_MOVEMENT_TONES) as StockMovementKind[];

/** A tab's automatic sections' values (`StockFacets`; REPLACE_WITH_API). */
export async function stockFacets(tab: StockFacetTab): Promise<StockFacets> {
  const { clinicFixtures } = await fixtureWorld();
  if (tab === 'items') {
    const rows = itemRows(clinicFixtures);
    return {
      rows: rows.length,
      values: {
        category: presentIn(
          CATEGORY_ORDER,
          rows.map((row) => row.category),
        ),
        lasts: runwayKeys(rows),
      },
    };
  }
  if (tab === 'purchases') {
    const rows = purchaseRows(clinicFixtures);
    return {
      rows: rows.length,
      values: {
        status: presentIn(
          STATUS_ORDER,
          rows.map((row) => row.status),
        ),
      },
    };
  }
  const rows = movementRows(clinicFixtures);
  return {
    rows: rows.length,
    values: {
      type: presentIn(
        MOVEMENT_ORDER,
        rows.map((row) => row.kind),
      ),
    },
  };
}
