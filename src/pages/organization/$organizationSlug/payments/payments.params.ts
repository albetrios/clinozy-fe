/**
 * The ledger read the Payments page makes from its URL (KICKOFF §6.9). Kept
 * out of `payments.search.ts` on purpose — `routeTree.tsx` (the entry chunk)
 * imports that module for `validateSearch`, so anything else exported from it
 * ships on the first paint; this module loads with the room.
 */
import type { LedgerListParams } from '@/shared/api/clinic/payments-contracts.ts';

import type { PaymentsSearch } from './payments.search.ts';

/**
 * The ledger read's params for the URL as it stands: its filters and search,
 * the header's branches, and — while Day close reviews one — the day.
 */
export function ledgerListParamsOf(
  search: PaymentsSearch,
  context: { branchIds: readonly string[]; day?: string },
): LedgerListParams {
  return {
    direction: search.direction,
    kind: search.kind,
    mode: search.mode,
    created: search.created,
    q: search.q,
    day: context.day,
    branchIds: context.branchIds.length > 0 ? [...context.branchIds] : undefined,
  };
}
