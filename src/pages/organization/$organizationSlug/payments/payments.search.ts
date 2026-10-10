/**
 * URL search-param schemas for the Payments room (consumed by routeTree's
 * `validateSearch`): the ledger's Show, What, Mode, Created and search (KICKOFF
 * §6.9, `S:84`). A value the URL can't hold is dropped, never an error. The
 * schema's `followUp` and `sort` are left as they come and unused: the ledger
 * has no Follow-up filter and no sortable column (`payments.md:31, 39`).
 *
 * The filters' values are the shared `LEDGER_FILTER_VALUES` — declared, not
 * imported from the contract: `routeTree.tsx` is the entry chunk, and the
 * generated schema module is pages of zod.
 */
import { listIn, oneOf, queryOf } from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type { PaymentDirection, PaymentMode } from '@/shared/api/clinic/clinic-schema.ts';
import { LEDGER_FILTER_VALUES } from '@/shared/api/clinic/ledger-filter-values.ts';
import type { LedgerKindFilter } from '@/shared/api/clinic/payments-contracts.ts';

/** Validated `?…` search params for `/payments` and its dialog routes. */
export interface PaymentsSearch {
  /** Show: Received or Paid (All when absent). */
  direction?: PaymentDirection;
  /** What: any of these kinds. */
  kind?: LedgerKindFilter[];
  /** Mode: any entry with a split in these modes. */
  mode?: PaymentMode[];
  created?: CreatedFilter;
  /**
   * The person (their name, mobile or contact number), the payee or a PAY- number (D81; ≤ 80
   * characters) — the API's `q`, which does not search invoice numbers.
   */
  q?: string;
}

/**
 * Parse `/payments` search params. Every key is answered, `undefined` included:
 * the router keeps a raw value the schema omits, so dropping one means saying so.
 */
export function validatePaymentsSearch(search: Record<string, unknown>): PaymentsSearch {
  return {
    direction: oneOf(LEDGER_FILTER_VALUES.direction, search.direction),
    kind: listIn(LEDGER_FILTER_VALUES.kind, search.kind),
    mode: listIn(LEDGER_FILTER_VALUES.mode, search.mode),
    created: readCreatedFilter(search.created),
    q: queryOf(search.q, 80),
  };
}
