import type { QueryKey } from '@tanstack/react-query';

import type { StockTab } from '@/lib/routes/index.ts';
import {
  type RoomDialogRouteState,
  useRoomDialogRoute,
} from '@/shared/hooks/useRoomDialogRoute/index.ts';

import {
  type StockCreateSearch,
  validateStockCreateSearch,
} from '../../../stock.search.ts';
import { useStockNav } from '../useStockNav/index.ts';

/** Options of {@link useStockDialogRoute}. */
export interface UseStockDialogRouteOptions<T> {
  tab: StockTab;
  /** The route param naming the record (`itemId`, `purchaseId`, `vendorId`). */
  param: string;
  queryKey: (id: string) => QueryKey;
  fetchRecord: (id: string) => Promise<T>;
  /** The record's name in "<Record> not found · it may have been deleted". */
  recordLabel: string;
  /** The tab's own action routes — Items' `check` (Stock check). */
  tabActions?: readonly string[];
}

/**
 * Which drawer a Clinic stock tab's URL opens (KICKOFF §6.8 Routes) — the
 * shared room dialog route over the Stock section: a create — and Stock check
 * — takes keeping the stock (Create with Edit, Q-K2), an unknown id goes back
 * to the list with "<Record> not found", and `close` keeps the tab's search,
 * filters and sort.
 */
export function useStockDialogRoute<T>({
  tab,
  ...options
}: UseStockDialogRouteOptions<T>): RoomDialogRouteState<T, StockCreateSearch> {
  const nav = useStockNav();
  return useRoomDialogRoute({
    ...options,
    section: 'stock',
    createActions: ['create', 'edit'],
    close: () => nav.close(tab),
    readPrefill: validateStockCreateSearch,
  });
}
