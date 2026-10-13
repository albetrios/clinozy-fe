/**
 * The read Clinic stock › Purchases makes from the URL (KICKOFF §6.8, `S:78`).
 * Kept out of `stock.search.ts`, which rides the entry chunk; this module
 * loads with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { StockPurchaseListParams } from '../shared/stock-contracts.ts';
import type { StockSearch } from '../stock.search.ts';

/**
 * The list read's params for the URL as it stands — what the tab hands
 * `useStockPurchaseList`. The API sorts by number, bill and due; by supplier
 * it does not, so a `vendor` sort is dropped.
 */
export function purchaseParamsOf(search: StockSearch): StockPurchaseListParams {
  return {
    q: search.q,
    status: search.status,
    vendor: search.vendor,
    created: search.created,
    ...sortParamsOf(search.sort, ['seq', 'bill', 'due'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function purchaseFilterKey(params: StockPurchaseListParams): string {
  return JSON.stringify([params.q, params.status, params.vendor, params.created]);
}
