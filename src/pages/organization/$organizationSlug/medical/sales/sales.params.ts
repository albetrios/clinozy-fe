/**
 * The read Medical › Sales makes from the URL (KICKOFF §6.7, `S:49`). Kept out
 * of `medical.search.ts`, which rides the entry chunk; this module loads with
 * the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { SaleListParams } from '../shared/medical-contracts.ts';

/**
 * The list read's params for the URL as it stands — what the tab hands `useSaleList`: the
 * search, Status (Unpaid · Paid · Returned), Created and the sort the API serves (Sale,
 * Customer, Bill).
 */
export function saleParamsOf(search: MedicalSearch): SaleListParams {
  return {
    q: search.q,
    status: search.status,
    created: search.created,
    ...sortParamsOf(search.sort, ['seq', 'customer', 'bill'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function saleFilterKey(params: SaleListParams): string {
  return JSON.stringify([params.q, params.status, params.created]);
}
