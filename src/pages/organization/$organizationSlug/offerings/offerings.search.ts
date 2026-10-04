/**
 * URL search-param schemas for the Offerings room (consumed by routeTree's
 * `validateSearch`): the Offerings tab's search, filters and sort (KICKOFF
 * §6.11 Routes; `S:98–100`, D22), the New offering prefill on `create/`
 * (`?name=`, `S:99`). A value the URL can't
 * hold — an unknown category, a bad date range — is dropped, never an error.
 * Defaults stay out of the URL (`/offerings` is every offering, newest first).
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum.
 */
import {
  listIn,
  listOf,
  queryOf,
  RECORD_ID,
  sortOf,
  textOf,
} from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readBranchFilter,
  readCreatedFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type { OfferingCategory } from '@/shared/api/clinic/clinic-schema.ts';

/** The categories, in the Filters chips' order (`S:1330`). */
export const OFFERING_CATEGORY_FILTER = [
  'consultation',
  'treatment',
  'package',
  'lhr',
  'product',
] as const satisfies readonly OfferingCategory[];

/** An offering's Status chips: Active · Inactive. */
export const OFFERING_STATUS_FILTER = ['active', 'inactive'] as const;

/** An offering's status in the URL. */
export type OfferingStatusFilter = (typeof OFFERING_STATUS_FILTER)[number];

/** The Offerings table's sortable columns (`offerings.md:33`). */
export const OFFERING_SORT_KEYS = [
  'seq',
  'name',
  'category',
  'price',
  'duration',
  'sessions',
  'status',
  'updated',
] as const;

/** One sortable Offerings column. */
export type OfferingSortKey = (typeof OFFERING_SORT_KEYS)[number];

/** A column sort in the URL: `price:desc`, `name:asc` (the shared table's form). */
export type OfferingsSort = `${OfferingSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for `/offerings` and its dialog routes. */
export interface OfferingsSearch {
  /** Name, search term or "#274" (≤ 80 characters, the contract's `q`). */
  q?: string;
  /** Any of these categories. */
  category?: OfferingCategory[];
  /** Any of these winning offers (offer ids). */
  offer?: string[];
  /** Sold at any of these branches (ids), or at every branch (`all`). */
  branch?: string[];
  /** Active, Inactive or both. */
  status?: OfferingStatusFilter[];
  created?: CreatedFilter;
  sort?: OfferingsSort;
}

/**
 * Parse `/offerings` search params. Every key is answered, `undefined`
 * included: the router keeps a raw value the schema omits, so dropping one
 * means saying so. The contract's `specialty` is the one key left unanswered:
 * accepted as it stands and unused (Q-O6), its value list kept off the entry.
 */
export function validateOfferingsSearch(
  search: Record<string, unknown>,
): OfferingsSearch {
  return {
    q: queryOf(search.q, 80),
    category: listIn(OFFERING_CATEGORY_FILTER, search.category),
    offer: listOf(search.offer, (entry) => RECORD_ID.test(entry)),
    branch: readBranchFilter(search.branch),
    status: listIn(OFFERING_STATUS_FILTER, search.status),
    created: readCreatedFilter(search.created),
    sort: sortOf(OFFERING_SORT_KEYS, search.sort),
  };
}

/** The New offering prefill (`S:99`): the name typed where it was asked for. */
export interface OfferingCreateSearch {
  /** The offering's name, as given (≤ 120 characters, the contract's). */
  name?: string;
}

/** Parse the `/offerings/create` prefill. */
export function validateOfferingCreateSearch(
  search: Record<string, unknown>,
): OfferingCreateSearch {
  const name = textOf(search.name);
  return { name: name && name.length <= 120 ? name : undefined };
}
