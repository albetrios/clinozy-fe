import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import {
  fetchAllStockItems,
  fetchAllStockVendors,
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
  stockListSummary,
  type StockPage,
  stockQueryKeys,
  type StockSummaryParams,
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

/*
 * The Clinic stock tabs' reads on clinozy-be — a cursor page of 50 at a time,
 * each key under the active organization, idle until there is one. While new
 * params load the previous rows stay; a failed read raises no toast here: the
 * tab keeps the last copy and offers Retry (KICKOFF §6.0).
 */

/** A page as the shared list hook reads it. */
const asListPage = <T>(page: StockPage<T>) => ({
  rows: page.rows,
  next: page.next,
  hasMore: page.next !== null,
});

/** Clinic stock › Items (`GET /app/stock-items`), each row with its vendor. */
export function useStockItemList(params: StockItemListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<StockItemRow>({
    queryKey: stockQueryKeys.items(organizationId, params),
    queryFn: async (after) => asListPage(await listStockItems(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Clinic stock › Purchases (`GET /app/stock-purchases`), each row with its vendor. */
export function useStockPurchaseList(params: StockPurchaseListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<StockPurchaseRow>({
    queryKey: stockQueryKeys.purchases(organizationId, params),
    queryFn: async (after) => asListPage(await listStockPurchases(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Clinic stock › Movements (`GET /app/stock-item-movements`), each row with its item and author. */
export function useStockMovementList(params: StockMovementListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<StockMovementRow>({
    queryKey: stockQueryKeys.movements(organizationId, params),
    queryFn: async (after) => asListPage(await listStockMovements(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Clinic stock › Vendors (`GET /app/stock-vendors`, Q-K1). */
export function useStockVendorList(params: StockVendorListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<StockVendorRow>({
    queryKey: stockQueryKeys.vendors(organizationId, params),
    queryFn: async (after) => asListPage(await listStockVendors(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** A tab's footer figures — how many rows match and what is due on them, in rupees. */
export function useStockSummary<T extends StockSummaryTab>(
  tab: T,
  params: StockSummaryParams[T],
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: stockQueryKeys.summary(organizationId, tab, params),
    queryFn: () => stockListSummary(tab, params),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/*
 * The whole lists the pickers, the Low stock chips, "Reorder low items", Stock
 * check and the rows' joins read: a clinic's items and vendors are a few
 * hundred at most (H:3723–3724).
 */

/** Every live item with its vendor, the latest first. */
export function useStockItemCatalogue() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: stockQueryKeys.catalogue(organizationId, 'items'),
    queryFn: fetchAllStockItems,
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Every live clinic vendor, by name. */
export function useStockVendorCatalogue() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: stockQueryKeys.catalogue(organizationId, 'vendors'),
    queryFn: fetchAllStockVendors,
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}
