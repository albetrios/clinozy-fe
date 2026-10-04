import type { CursorPage } from '@/shared/api/clinic/clinic-fixture-store.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';

import {
  fetchAllStockItems,
  fetchAllStockVendors,
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
  stockFacets,
  type StockFacetTab,
  stockListSummary,
  stockQueryKeys,
  type StockSummaryTab,
} from '../../stock-api.ts';
import type {
  StockItemListParams,
  StockItemRow,
  StockMovementListParams,
  StockMovementRow,
  StockPurchaseListParams,
  StockPurchaseRow,
  StockVendorListParams,
  StockVendorRow,
} from '../../stock-contracts.ts';

/** A cursor page as the shared list hook reads it. */
const asListPage = <T>(page: CursorPage<T>) => ({
  rows: page.items,
  next: page.nextCursor,
  hasMore: page.nextCursor !== null,
});

/*
 * The Clinic stock tabs' list reads — a cursor page of 50 at a time (D7). While
 * new params load the previous rows stay; a failed read raises no toast here:
 * the tab keeps the last copy and offers Retry (KICKOFF §6.0).
 */

/** Clinic stock › Items (`S:1681`). */
export function useStockItemList(params: StockItemListParams) {
  return useCursorList<StockItemRow>({
    queryKey: stockQueryKeys.items(params),
    queryFn: async (after) => asListPage(await listStockItems(params, after ?? null)),
    notifyOnError: false,
  });
}

/** Clinic stock › Purchases (`S:1683`). */
export function useStockPurchaseList(params: StockPurchaseListParams) {
  return useCursorList<StockPurchaseRow>({
    queryKey: stockQueryKeys.purchases(params),
    queryFn: async (after) => asListPage(await listStockPurchases(params, after ?? null)),
    notifyOnError: false,
  });
}

/** Clinic stock › Movements (`S:1682`). */
export function useStockMovementList(params: StockMovementListParams) {
  return useCursorList<StockMovementRow>({
    queryKey: stockQueryKeys.movements(params),
    queryFn: async (after) => asListPage(await listStockMovements(params, after ?? null)),
    notifyOnError: false,
  });
}

/** Clinic stock › Vendors (`S:1684`, Q-K1). */
export function useStockVendorList(params: StockVendorListParams) {
  return useCursorList<StockVendorRow>({
    queryKey: stockQueryKeys.vendors(params),
    queryFn: async (after) => asListPage(await listStockVendors(params, after ?? null)),
    notifyOnError: false,
  });
}

/** A tab's footer figures — how many rows match and what is due on them. */
export function useStockSummary(tab: StockSummaryTab, params: object) {
  return useAppQuery({
    queryKey: stockQueryKeys.summary(tab, params),
    queryFn: () => stockListSummary(tab, params),
    notifyOnError: false,
  });
}

/** A tab's automatic Filters sections — the values its whole list holds. */
export function useStockFacets(tab: StockFacetTab) {
  return useAppQuery({
    queryKey: stockQueryKeys.facets(tab),
    queryFn: () => stockFacets(tab),
    notifyOnError: false,
  });
}

/*
 * The whole lists the pickers, the Low stock chips, "Reorder low items" and
 * Stock check read: the clinic's items and vendors are few (H:3723–3724).
 */

/** Every live item, the latest first. */
export function useStockItemCatalogue() {
  return useAppQuery({
    queryKey: stockQueryKeys.catalogue('items'),
    queryFn: fetchAllStockItems,
    notifyOnError: false,
  });
}

/** Every live clinic vendor, by name. */
export function useStockVendorCatalogue() {
  return useAppQuery({
    queryKey: stockQueryKeys.catalogue('vendors'),
    queryFn: fetchAllStockVendors,
    notifyOnError: false,
  });
}
