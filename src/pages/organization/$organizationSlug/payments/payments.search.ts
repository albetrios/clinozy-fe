/**
 * URL search-param schemas for the Payments room (consumed by routeTree's
 * `validateSearch`): the ledger's Show, What, Mode, Created and search (KICKOFF
 * §6.9, `S:84`). A value the URL can't hold is dropped, never an error. The
 * schema's `followUp` and `sort` are left as they come and unused: the ledger
 * has no Follow-up filter and no sortable column (`payments.md:31, 39`).
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod. The test pins
 * each list to the contract's enum.
 */
import {
  listOf,
  matchOf,
  oneOf,
  queryOf,
  RECORD_ID,
  textOf,
} from '@/lib/routes/search-params.ts';
import {
  CALENDAR_DATE,
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';
import type { PaymentDirection, PaymentMode } from '@/shared/api/clinic/clinic-schema.ts';
import type { LedgerKindFilter } from '@/shared/api/clinic/payments-contracts.ts';

/** Each ledger filter's values, in the chip order (`payments.md:39`). */
export const LEDGER_FILTER_VALUES = {
  direction: ['received', 'paid'],
  kind: ['receipt', 'refund', 'expense', 'money_back'],
  mode: ['cash', 'upi', 'card', 'credit'],
} as const satisfies {
  direction: readonly PaymentDirection[];
  kind: readonly LedgerKindFilter[];
  mode: readonly PaymentMode[];
};

/** Validated `?…` search params for `/payments` and its dialog routes. */
export interface PaymentsSearch {
  /** Show: Received or Paid (All when absent). */
  direction?: PaymentDirection;
  /** What: any of these kinds. */
  kind?: LedgerKindFilter[];
  /** Mode: any entry with a split in these modes. */
  mode?: PaymentMode[];
  created?: CreatedFilter;
  /** A PAY- number, the party or an invoice number (≤ 80 characters). */
  q?: string;
}

/** Keep the entries of a URL list that `values` names. */
function listIn<T extends string>(values: readonly T[], value: unknown): T[] | undefined {
  return listOf<T>(value, (entry) => oneOf(values, entry) !== undefined);
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

/**
 * `/payments/receive` (`S:85`): the patient and the invoice to prefill, and the
 * room it was opened from — kept behind the drawer (KICKOFF §4, A-P1), held as
 * text here and checked where it is used (`safeReferrer`), so the entry chunk
 * carries no allow-list.
 */
export interface PaymentReceiveSearch {
  patient?: string;
  invoice?: string;
  from?: string;
}

/** Parse the Receive drawer's params. */
export function validatePaymentReceiveSearch(
  search: Record<string, unknown>,
): PaymentReceiveSearch {
  return {
    patient: matchOf(RECORD_ID, search.patient),
    invoice: matchOf(RECORD_ID, search.invoice),
    from: textOf(search.from) || undefined,
  };
}

/** A supplier bill in the URL: `md:<poId>` (Medical) or `is:<purchaseId>` (Clinic stock). */
const BILL_PARAM = /^(md|is):[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** `/payments/pay` (`S:86`): the supplier bill Medical or Clinic stock's "Pay ₹X" opens it on. */
export interface PaymentPaySearch {
  bill?: string;
}

/** Parse Send payment's params. */
export function validatePaymentPaySearch(
  search: Record<string, unknown>,
): PaymentPaySearch {
  return { bill: matchOf(BILL_PARAM, search.bill) };
}

/** `/payments/day-close` (`S:91`): the day (default today) and the branch. */
export interface DayCloseSearch {
  date?: string;
  branch?: string;
}

/** Parse Day close's params. */
export function validateDayCloseSearch(search: Record<string, unknown>): DayCloseSearch {
  return {
    date: matchOf(CALENDAR_DATE, search.date),
    branch: matchOf(RECORD_ID, search.branch),
  };
}
