/**
 * URL search-param schema for Payments › Pending (consumed by routeTree's
 * `validateSearch`): which way, the state, Created and search (KICKOFF §6.9,
 * `S:88`). A value the URL can't hold is dropped, never an error. The
 * contract's values are declared here, not imported — `routeTree.tsx` is the
 * entry chunk; the test pins each list to the contract's enum.
 */
import { listOf, oneOf, queryOf } from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type { CreditDirection, CreditStatus } from '@/shared/api/clinic/clinic-schema.ts';

/** Each Pending filter's values, in the chip order (`payments.md:45`). */
export const PENDING_FILTER_VALUES = {
  direction: ['give', 'take'],
  status: ['open', 'given_back', 'got_back', 'used'],
} as const satisfies {
  direction: readonly CreditDirection[];
  status: readonly CreditStatus[];
};

/** Validated `?…` search params for `/payments/pending` and its dialog routes. */
export interface PendingSearch {
  /** Give, Take or both. */
  direction?: CreditDirection[];
  /** Any of these states. */
  status?: CreditStatus[];
  created?: CreatedFilter;
  /** A CR- number, the party or the reason (≤ 80 characters). */
  q?: string;
}

/** Keep the entries of a URL list that `values` names. */
function listIn<T extends string>(values: readonly T[], value: unknown): T[] | undefined {
  return listOf<T>(value, (entry) => oneOf(values, entry) !== undefined);
}

/** Parse `/payments/pending` search params; every key is answered. */
export function validatePendingSearch(search: Record<string, unknown>): PendingSearch {
  return {
    direction: listIn(PENDING_FILTER_VALUES.direction, search.direction),
    status: listIn(PENDING_FILTER_VALUES.status, search.status),
    created: readCreatedFilter(search.created),
    q: queryOf(search.q, 80),
  };
}
