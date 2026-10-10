/**
 * The read Clinic stock › Vendors makes from the URL (KICKOFF §6.8, `S:81`;
 * Q-K1): its search (the name) and sort — Vendor or Payable, both clinozy-be's
 * (`sort=name`, `sort=payable`). Kept out of `stock.search.ts`, which rides the
 * entry chunk; this module loads with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { StockVendorListParams } from '../shared/stock-contracts.ts';
import type { StockSearch } from '../stock.search.ts';

/** The list read's params for the URL as it stands — what the tab hands `useStockVendorList`. */
export function vendorParamsOf(search: StockSearch): StockVendorListParams {
  return {
    q: search.q,
    ...sortParamsOf(search.sort, ['name', 'payable'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function vendorFilterKey(params: StockVendorListParams): string {
  return JSON.stringify([params.q]);
}
