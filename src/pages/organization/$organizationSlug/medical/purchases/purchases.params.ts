/**
 * The read Medical › Purchases makes from the URL (KICKOFF §6.7, `S:56`). Kept
 * out of `medical.search.ts`, which rides the entry chunk; this module loads
 * with the tab.
 */
import { sortParamsOf } from '@/lib/routes/search-params.ts';

import type { MedicalSearch } from '../medical.search.ts';
import type { PurchaseOrderListParams } from '../shared/medical-contracts.ts';

/** The list read's params for the URL as it stands — what the tab hands `usePurchaseOrderList`. */
export function purchaseOrderParamsOf(search: MedicalSearch): PurchaseOrderListParams {
  return {
    q: search.q,
    stage: search.stage,
    created: search.created,
    ...sortParamsOf(search.sort, ['seq', 'supplier', 'total', 'stage'] as const),
  };
}

/** The read's filter part — a change shows the skeleton; a sort keeps the rows. */
export function purchaseOrderFilterKey(params: PurchaseOrderListParams): string {
  return JSON.stringify([params.q, params.stage, params.created]);
}
