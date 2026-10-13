/**
 * URL search-param schema for the Offers tab (consumed by routeTree's
 * `validateSearch`): its search and filters (KICKOFF §6.11 Routes; `S:101`,
 * D22) — no sort, the tab keeps its fixed order. A value the URL can't hold is
 * dropped, never an error; defaults stay out of the URL.
 */
import { listIn, queryOf } from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readBranchFilter,
  readCreatedFilter,
} from '@/shared/api/app/app-list-filters.ts';
import type { OfferStatus } from '@/shared/api/app/offerings-contracts.ts';

/** The offer statuses, in the tab's order (`S:101`; the test pins them). */
export const OFFER_STATE_FILTER = [
  'live',
  'scheduled',
  'paused',
  'ended',
] as const satisfies readonly OfferStatus[];

/** Validated `?…` search params for `/offerings/offers` and its dialog routes. */
export interface OffersSearch {
  /** Name, code or an offering's name (≤ 80 characters). */
  q?: string;
  /** Any of these statuses. */
  status?: OfferStatus[];
  /** Usable at any of these branches (ids, `brn_…`), or at every branch (`all`). */
  branch?: string[];
  created?: CreatedFilter;
}

/**
 * Parse `/offerings/offers` search params. Every key is answered, `undefined`
 * included: the router keeps a raw value the schema omits.
 */
export function validateOffersSearch(search: Record<string, unknown>): OffersSearch {
  return {
    q: queryOf(search.q, 80),
    status: listIn(OFFER_STATE_FILTER, search.status),
    branch: readBranchFilter(search.branch),
    created: readCreatedFilter(search.created),
  };
}
