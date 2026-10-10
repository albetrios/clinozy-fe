import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { createdRangeOf } from '@/shared/api/clinic/clinic-filter-ranges.ts';
import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  fetchTeamDirectory,
  teamDirectoryQueryKey,
} from '@/shared/api/clinic/directory-api.ts';
import { STOCK_ROOM_QUERY_KEY } from '@/shared/api/clinic/stock-room-query-key.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  type StockItemListParams,
  type StockItemRecord,
  type StockItemRow,
  stockItemRowWire,
  stockItemWire,
  type StockListSummary,
  type StockMovementListParams,
  type StockMovementRow,
  stockMovementRowWire,
  stockPurchaseListMetaWire,
  type StockPurchaseListParams,
  type StockPurchaseRecord,
  type StockPurchaseRow,
  stockPurchaseRowWire,
  stockPurchaseWire,
  type StockStaffRef,
  stockVendorListMetaWire,
  type StockVendorListParams,
  type StockVendorRef,
  type StockVendorRow,
  stockVendorRowWire,
  toStockItemRecord,
  toStockMovementItem,
  toStockMovementRow,
  toStockPurchaseRecord,
  toStockVendorRef,
  toStockVendorRow,
} from './stock-contracts.ts';

/*
 * Clinic stock's reads on clinozy-be (api-integration §5.6): the four tabs in
 * cursor pages of 50, one record of each, the whole item and vendor lists the
 * pickers and Stock check read (every page, 100 at a time), and the footer
 * figures. A row's vendor, a movement's item and its author are joined from
 * those lists and the team directory — one cached read per list, never one per
 * row. Every key carries the organization.
 */

/** TanStack Query keys for Clinic stock — all under `['clinic', 'stock']`, each carrying the organization. */
export const stockQueryKeys = {
  all: STOCK_ROOM_QUERY_KEY,
  /** Every Items read — a delete patches and refreshes them all. */
  itemLists: (organizationId: string | null) =>
    [...stockQueryKeys.all, organizationId, 'items'] as const,
  items: (organizationId: string | null, params: StockItemListParams) =>
    [...stockQueryKeys.itemLists(organizationId), params] as const,
  item: (organizationId: string | null, id: string) =>
    [...stockQueryKeys.all, organizationId, 'item', id] as const,
  /** Every Purchases read. */
  purchaseLists: (organizationId: string | null) =>
    [...stockQueryKeys.all, organizationId, 'purchases'] as const,
  purchases: (organizationId: string | null, params: StockPurchaseListParams) =>
    [...stockQueryKeys.purchaseLists(organizationId), params] as const,
  purchase: (organizationId: string | null, id: string) =>
    [...stockQueryKeys.all, organizationId, 'purchase', id] as const,
  /** Every Movements read. */
  movementLists: (organizationId: string | null) =>
    [...stockQueryKeys.all, organizationId, 'movements'] as const,
  movements: (organizationId: string | null, params: StockMovementListParams) =>
    [...stockQueryKeys.movementLists(organizationId), params] as const,
  /** Every Vendors read. */
  vendorLists: (organizationId: string | null) =>
    [...stockQueryKeys.all, organizationId, 'vendors'] as const,
  vendors: (organizationId: string | null, params: StockVendorListParams) =>
    [...stockQueryKeys.vendorLists(organizationId), params] as const,
  vendor: (organizationId: string | null, id: string) =>
    [...stockQueryKeys.all, organizationId, 'vendor', id] as const,
  /** Every footer figure. */
  summaries: (organizationId: string | null) =>
    [...stockQueryKeys.all, organizationId, 'summary'] as const,
  /** A tab's footer figures, by tab and params. */
  summary: (organizationId: string | null, tab: StockSummaryTab, params: object) =>
    [...stockQueryKeys.summaries(organizationId), tab, params] as const,
  /** Both whole lists. */
  catalogues: (organizationId: string | null) =>
    [...stockQueryKeys.all, organizationId, 'catalogue'] as const,
  /** A whole list the pickers, chips, Stock check and the rows' joins read. */
  catalogue: (organizationId: string | null, kind: 'items' | 'vendors') =>
    [...stockQueryKeys.catalogues(organizationId), kind] as const,
};

/**
 * Every read of one organization but the records' own — what a delete refreshes:
 * the deleted record's read would only answer 404 while its drawer closes.
 */
export const stockListReadKeys = (organizationId: string | null) => [
  stockQueryKeys.itemLists(organizationId),
  stockQueryKeys.purchaseLists(organizationId),
  stockQueryKeys.movementLists(organizationId),
  stockQueryKeys.vendorLists(organizationId),
  stockQueryKeys.summaries(organizationId),
  stockQueryKeys.catalogues(organizationId),
];

/** One page of a tab — the design's 50. */
const PAGE_SIZE = 50;

/** One page of a whole list — the API's most. */
const CATALOGUE_PAGE_SIZE = 100;

/** The organization the cached lists belong to. */
const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

/** A list page's cursor: the next one while there is more. */
function nextOf(
  meta: { pagination?: { has_more?: boolean; next?: string | null } } | undefined,
) {
  return meta?.pagination?.has_more ? (meta.pagination.next ?? null) : null;
}

/** The API's estimated count of the whole list — on its first page; null when left out. */
const pageTotal = (meta: { pagination?: { estimated_total?: number } } | undefined) =>
  meta?.pagination?.estimated_total ?? null;

/** The Created filter as the API's range, on the clinic's `today`. */
function createdQuery(created: CreatedFilter | undefined, today: string) {
  const range = created ? createdRangeOf(created, today) : {};
  return { created_from: range.from, created_to: range.to };
}

/** A search as the API takes it — none when blank. */
const searchOf = (q: string | undefined) => (q?.trim() ? q.trim() : undefined);

/** A list filter as the API takes it — comma-joined, none when empty. */
const listOf = (values: readonly string[] | undefined) =>
  values?.length ? values.join(',') : undefined;

/** A page of rows with the cursor of the next and the API's estimated total. */
export interface StockPage<T> {
  rows: T[];
  next: string | null;
  total: number | null;
}

// ── The whole lists ──

/** Every live clinic vendor as their row, by name (`GET /app/stock-vendors`, every page). */
export async function fetchAllStockVendors(): Promise<StockVendorRow[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/stock-vendors', {
      query: { limit: CATALOGUE_PAGE_SIZE, after: after ?? undefined, sort: 'name' },
    });
    return {
      rows: z
        .array(stockVendorRowWire)
        .parse(response.data ?? [])
        .map(toStockVendorRow),
      next: nextOf(response.meta),
    };
  }, 'stock-vendors');
}

/** The vendors by id as the rows name them — the vendor list, read once and cached. */
async function vendorRefs(): Promise<ReadonlyMap<string, StockVendorRef>> {
  const vendors = await queryClient.query({
    queryKey: stockQueryKeys.catalogue(activeOrganizationId(), 'vendors'),
    queryFn: fetchAllStockVendors,
  });
  return new Map(vendors.map((vendor) => [vendor.id, toStockVendorRef(vendor)]));
}

/** An item with its vendor (null for a vendor deleted since). */
const itemRowOf = (
  item: StockItemRecord,
  vendors: ReadonlyMap<string, StockVendorRef>,
): StockItemRow => ({
  ...item,
  vendor: item.vendorId ? (vendors.get(item.vendorId) ?? null) : null,
});

/** Items with their vendors, from the vendor list. */
async function withVendors(items: StockItemRecord[]): Promise<StockItemRow[]> {
  if (items.length === 0) return [];
  const vendors = await vendorRefs();
  return items.map((item) => itemRowOf(item, vendors));
}

/** Every live item as its row, the latest first (`GET /app/stock-items`, every page). */
export async function fetchAllStockItems(): Promise<StockItemRow[]> {
  const items = await collectAllPages(async (after) => {
    const response = await api.get('/app/stock-items', {
      query: {
        limit: CATALOGUE_PAGE_SIZE,
        after: after ?? undefined,
        sort: 'stock_item_number',
        order: 'desc',
      },
    });
    return {
      rows: z
        .array(stockItemRowWire)
        .parse(response.data ?? [])
        .map(toStockItemRecord),
      next: nextOf(response.meta),
    };
  }, 'stock-items');
  return withVendors(items);
}

// ── Items ──

/** The Items sorts as the API names them. */
const ITEM_SORTS = {
  seq: 'stock_item_number',
  name: 'name',
  category: 'category',
  stock: 'quantity',
  lasts: 'lasts_days',
} as const;

/** The Items read's query for the URL's params, on the clinic's `today` — by name by default. */
export function stockItemListQuery(
  params: StockItemListParams,
  today: string = clinicToday(),
) {
  return {
    limit: PAGE_SIZE,
    q: searchOf(params.q),
    // Low stock is everything at or below its minimum — the empty shelves too.
    stock_level: params.stock === 'low' ? 'low,out' : undefined,
    lasts_days_to: params.lastsDaysTo,
    category: listOf(params.category),
    ...createdQuery(params.created, today),
    sort: params.sort ? ITEM_SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** One page of items, each with its vendor; `after` is the cursor. */
export async function listStockItems(
  params: StockItemListParams,
  after?: string,
): Promise<StockPage<StockItemRow>> {
  const response = await api.get('/app/stock-items', {
    query: { ...stockItemListQuery(params), after },
  });
  const items = z
    .array(stockItemRowWire)
    .parse(response.data ?? [])
    .map(toStockItemRecord);
  return {
    rows: await withVendors(items),
    next: nextOf(response.meta),
    total: pageTotal(response.meta),
  };
}

/** One item as its row — a 404 when it is unknown or deleted. */
export async function fetchStockItem(id: string): Promise<StockItemRow> {
  const response = await api.get('/app/stock-items/{stock_item_id}', {
    params: { stock_item_id: id },
  });
  const item = toStockItemRecord(stockItemWire.parse(response.data));
  return itemRowOf(item, await vendorRefs());
}

// ── Purchases ──

/** The Purchases sorts as the API names them; none is the bill date, the latest first. */
const PURCHASE_SORTS = {
  seq: 'stock_purchase_number',
  bill: 'bill_amount',
  due: 'due_amount',
} as const;

/** The Purchases filters as the API takes them, on the clinic's `today`. */
function purchaseFilterQuery(
  params: Pick<StockPurchaseListParams, 'q' | 'status' | 'vendor' | 'created'>,
  today: string,
) {
  return {
    q: searchOf(params.q),
    payment_status: listOf(params.status),
    stock_vendor_id: params.vendor,
    ...createdQuery(params.created, today),
  };
}

/** The Purchases read's query for the URL's params, on the clinic's `today`. */
export function stockPurchaseListQuery(
  params: StockPurchaseListParams,
  today: string = clinicToday(),
) {
  return {
    limit: PAGE_SIZE,
    ...purchaseFilterQuery(params, today),
    sort: params.sort ? PURCHASE_SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** A purchase with its vendor (null for a vendor deleted since). */
const purchaseRowOf = (
  purchase: StockPurchaseRecord,
  vendors: ReadonlyMap<string, StockVendorRef>,
): StockPurchaseRow => ({ ...purchase, vendor: vendors.get(purchase.vendorId) ?? null });

/** One page of purchases, each with its vendor; `after` is the cursor. */
export async function listStockPurchases(
  params: StockPurchaseListParams,
  after?: string,
): Promise<StockPage<StockPurchaseRow>> {
  const response = await api.get('/app/stock-purchases', {
    query: { ...stockPurchaseListQuery(params), after },
  });
  const purchases = z
    .array(stockPurchaseRowWire)
    .parse(response.data ?? [])
    .map(toStockPurchaseRecord);
  const vendors =
    purchases.length > 0 ? await vendorRefs() : new Map<string, StockVendorRef>();
  return {
    rows: purchases.map((purchase) => purchaseRowOf(purchase, vendors)),
    next: nextOf(response.meta),
    total: pageTotal(response.meta),
  };
}

/** One purchase as its row — a 404 when it is unknown or deleted. */
export async function fetchStockPurchase(id: string): Promise<StockPurchaseRow> {
  const response = await api.get('/app/stock-purchases/{stock_purchase_id}', {
    params: { stock_purchase_id: id },
  });
  const purchase = toStockPurchaseRecord(stockPurchaseWire.parse(response.data));
  return purchaseRowOf(purchase, await vendorRefs());
}

/**
 * A vendor's oldest bill with something due — what Vendors' "Pay ₹X" pays, read once on the
 * click (never a read per row): `GET /app/stock-purchases?stock_vendor_id=&payment_status=
 * unpaid,partial&sort=purchase_date&order=asc&limit=1`. Null when nothing is owed to them now.
 */
export async function fetchOldestOpenStockPurchase(
  vendorId: string,
): Promise<StockPurchaseRecord | null> {
  const response = await api.get('/app/stock-purchases', {
    query: {
      stock_vendor_id: vendorId,
      payment_status: listOf(['unpaid', 'partial']),
      sort: 'purchase_date',
      order: 'asc',
      limit: 1,
    },
  });
  const [oldest] = z.array(stockPurchaseRowWire).parse(response.data ?? []);
  return oldest ? toStockPurchaseRecord(oldest) : null;
}

// ── Movements ──

/** The Movements read's query for the URL's params, on the clinic's `today` — newest first. */
export function stockMovementListQuery(
  params: StockMovementListParams,
  today: string = clinicToday(),
) {
  return {
    limit: PAGE_SIZE,
    type: listOf(params.type),
    stock_item_id: params.item,
    ...createdQuery(params.created, today),
  };
}

/** The team by membership id as the "By" cell shows them — the team directory, cached. */
async function staffRefs(): Promise<ReadonlyMap<string, StockStaffRef>> {
  const team = await queryClient.query({
    queryKey: teamDirectoryQueryKey(activeOrganizationId()),
    queryFn: fetchTeamDirectory,
    staleTime: 5 * 60_000,
  });
  return new Map(
    team.map((member) => [
      member.id,
      { id: member.id, name: member.name, initials: member.initials, tone: member.tone },
    ]),
  );
}

/** One page of Movements rows, each with its item and author; `after` is the cursor. */
export async function listStockMovements(
  params: StockMovementListParams,
  after?: string,
): Promise<StockPage<StockMovementRow>> {
  const response = await api.get('/app/stock-item-movements', {
    query: { ...stockMovementListQuery(params), after },
  });
  const movements = z.array(stockMovementRowWire).parse(response.data ?? []);
  if (movements.length === 0) {
    return { rows: [], next: nextOf(response.meta), total: pageTotal(response.meta) };
  }
  const [items, staff] = await Promise.all([
    queryClient.query({
      queryKey: stockQueryKeys.catalogue(activeOrganizationId(), 'items'),
      queryFn: fetchAllStockItems,
    }),
    staffRefs(),
  ]);
  const byId = new Map(items.map((item) => [item.id, toStockMovementItem(item)]));
  return {
    rows: movements.map((movement) =>
      toStockMovementRow(movement, {
        item: byId.get(movement.stock_item_id) ?? null,
        by: movement.author_membership_id
          ? (staff.get(movement.author_membership_id) ?? null)
          : null,
      }),
    ),
    next: nextOf(response.meta),
    total: pageTotal(response.meta),
  };
}

// ── Vendors ──

/** One page of vendors, by name; `after` is the cursor. */
export async function listStockVendors(
  params: StockVendorListParams,
  after?: string,
): Promise<StockPage<StockVendorRow>> {
  const response = await api.get('/app/stock-vendors', {
    query: {
      limit: PAGE_SIZE,
      q: searchOf(params.q),
      sort: params.sort,
      order: params.sort ? params.order : undefined,
      after,
    },
  });
  return {
    rows: z
      .array(stockVendorRowWire)
      .parse(response.data ?? [])
      .map(toStockVendorRow),
    next: nextOf(response.meta),
    total: pageTotal(response.meta),
  };
}

/** One vendor as their row — a 404 when they are unknown or deleted. */
export async function fetchStockVendor(id: string): Promise<StockVendorRow> {
  const response = await api.get('/app/stock-vendors/{stock_vendor_id}', {
    params: { stock_vendor_id: id },
  });
  return toStockVendorRow(stockVendorRowWire.parse(response.data));
}

// ── Footer figures ──

/** A tab with footer figures (Items has none, `clinic-stock.md:19`). */
export type StockSummaryTab = 'purchases' | 'movements' | 'vendors';

/** The params each tab's footer reads. */
export type StockSummaryParams = {
  purchases: StockPurchaseListParams;
  movements: StockMovementListParams;
  vendors: StockVendorListParams;
};

/** How many purchases match and what is due on them (`meta.due_total`), one row read. */
async function purchaseSummary(
  params: StockPurchaseListParams,
  today: string,
): Promise<StockListSummary> {
  const response = await api.get('/app/stock-purchases', {
    query: { ...purchaseFilterQuery(params, today), limit: 1 },
  });
  const meta = stockPurchaseListMetaWire.safeParse(response.meta);
  return {
    total: pageTotal(response.meta),
    due: meta.success ? meta.data.due_total : null,
  };
}

/** How many vendors match and what is owed to them (`meta.payable_total`, follows the search). */
async function vendorSummary(params: StockVendorListParams): Promise<StockListSummary> {
  const response = await api.get('/app/stock-vendors', {
    query: { q: searchOf(params.q), limit: 1 },
  });
  const meta = stockVendorListMetaWire.safeParse(response.meta);
  return {
    total: pageTotal(response.meta),
    due: meta.success ? meta.data.payable_total : null,
  };
}

/** How many movements match — they owe nothing. */
async function movementSummary(
  params: StockMovementListParams,
  today: string,
): Promise<StockListSummary> {
  const response = await api.get('/app/stock-item-movements', {
    query: { ...stockMovementListQuery(params, today), limit: 1 },
  });
  return { total: pageTotal(response.meta), due: null };
}

/** Each tab's footer read. */
const SUMMARY_READERS: {
  [T in StockSummaryTab]: (
    params: StockSummaryParams[T],
    today: string,
  ) => Promise<StockListSummary>;
} = {
  purchases: purchaseSummary,
  movements: movementSummary,
  vendors: vendorSummary,
};

/**
 * A tab's footer figures (`clinic-stock.md:19`): how many rows match and, on
 * Purchases and Vendors, what is due — each one read of a single row, for the
 * list's own filters.
 */
export function stockListSummary<T extends StockSummaryTab>(
  tab: T,
  params: StockSummaryParams[T],
  today: string = clinicToday(),
): Promise<StockListSummary> {
  const read: (
    params: StockSummaryParams[T],
    today: string,
  ) => Promise<StockListSummary> = SUMMARY_READERS[tab];
  return read(params, today);
}
