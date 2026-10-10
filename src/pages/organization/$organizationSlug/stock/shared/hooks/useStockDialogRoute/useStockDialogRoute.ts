import type { QueryKey } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';

import type { StockTab } from '@/lib/routes/stock-builders.ts';
import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import {
  type RoomDialogRouteState,
  useRoomDialogRoute,
} from '@/shared/hooks/useRoomDialogRoute/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  type StockCreateSearch,
  validateStockCreateSearch,
} from '../../../stock.dialog-search.ts';
import { useStockNav } from '../useStockNav/index.ts';

/** Options of {@link useStockDialogRoute}. */
export interface UseStockDialogRouteOptions<T> {
  tab: StockTab;
  /** The route param naming the record (`itemId`, `purchaseId`, `vendorId`). */
  param: string;
  /** The record's query key in the organization (`stockQueryKeys.item`). */
  queryKey: (organizationId: string | null, id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in "<Record> not found · it may have been deleted". */
  recordLabel: string;
  /** The tab's own action routes — Items' `check` (Stock check). */
  tabActions?: readonly string[];
}

/** A create needs Create; Stock check moves stock, so it needs Edit (`stock_item:update`). */
const CREATE: readonly ClinicAction[] = ['create'];
const CHECK: readonly ClinicAction[] = ['edit'];

/**
 * Which drawer a Clinic stock tab's URL opens (KICKOFF §6.8 Routes) — the
 * shared room dialog route over the Stock section: a create takes Create and
 * Stock check takes Edit, an unknown id goes back to the list with "<Record>
 * not found", and `close` keeps the tab's search, filters and sort. The
 * record's key carries the active organization.
 */
export function useStockDialogRoute<T>({
  tab,
  queryKey,
  ...options
}: UseStockDialogRouteOptions<T>): RoomDialogRouteState<T, StockCreateSearch> {
  const nav = useStockNav();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const onCheck = useLocation({
    select: (location) => /\/check\/?$/.test(location.pathname),
  });
  return useRoomDialogRoute({
    ...options,
    queryKey: (id) => queryKey(organizationId, id),
    section: 'stock',
    createActions: onCheck ? CHECK : CREATE,
    close: () => nav.close(tab),
    readPrefill: validateStockCreateSearch,
  });
}
