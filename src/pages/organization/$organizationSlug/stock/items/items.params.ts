/**
 * The read Clinic stock › Items makes from the URL (KICKOFF §6.8, `S:73`). Kept
 * out of `stock.search.ts`, which rides the entry chunk; this module loads
 * with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { StockItemListParams } from '../shared/stock-contracts.ts';
import type { StockSearch } from '../stock.search.ts';

/** The list read's params for the URL as it stands — what the tab hands `useStockItemList`. */
export function itemParamsOf(search: StockSearch): StockItemListParams {
  return {
    q: search.q,
    stock: search.stock,
    category: search.category,
    lasts: search.lasts,
    created: search.created,
    ...sortParamsOf(search.sort, ['seq', 'name', 'category', 'stock', 'lasts'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function itemFilterKey(params: StockItemListParams): string {
  return JSON.stringify([
    params.q,
    params.stock,
    params.category,
    params.lasts,
    params.created,
  ]);
}
