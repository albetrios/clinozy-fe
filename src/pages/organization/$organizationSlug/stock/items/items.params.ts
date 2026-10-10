/**
 * The read Clinic stock › Items makes from the URL (KICKOFF §6.8, `S:73`). Kept
 * out of `stock.search.ts`, which rides the entry chunk; this module loads
 * with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { StockItemListParams } from '../shared/stock-contracts.ts';
import type { STOCK_LASTS_FILTERS, StockSearch } from '../stock.search.ts';

/** One Lasts tier of the Filters. */
export type StockLastsFilter = (typeof STOCK_LASTS_FILTERS)[number];

/**
 * Each Lasts tier's upper bound in days (`lasts_days_to`, inclusive): a week —
 * the runway pill's blush band — and three weeks, its butter band.
 */
export const LASTS_DAYS_TO: Readonly<Record<StockLastsFilter, number>> = {
  week: 7,
  three_weeks: 21,
};

/** The list read's params for the URL as it stands — what the tab hands `useStockItemList`. */
export function itemParamsOf(search: StockSearch): StockItemListParams {
  return {
    q: search.q,
    stock: search.stock,
    lastsDaysTo: search.lasts ? LASTS_DAYS_TO[search.lasts] : undefined,
    category: search.category,
    created: search.created,
    ...sortParamsOf(search.sort, ['seq', 'name', 'category', 'stock', 'lasts'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function itemFilterKey(params: StockItemListParams): string {
  return JSON.stringify([
    params.q,
    params.stock,
    params.lastsDaysTo,
    params.category,
    params.created,
  ]);
}
