/**
 * The search schemas of the Payments room — Receive payment (`S:85`), Send payment
 * (`S:86`) and Day close (`S:91`) over the ledger. Kept out of
 * `payments.search.ts` on purpose: `routeTree.tsx` (the entry chunk) imports that
 * module for the page's `validateSearch`, so a dialog's schema there ships on
 * every first paint. The dialog route only types its search from here
 * (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer parses it,
 * and this module loads with the room.
 */
import { matchOf, PUBLIC_ID, textOf } from '@/lib/routes/search-params.ts';
import { CALENDAR_DATE } from '@/shared/api/clinic/clinic-list-filters.ts';

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
    patient: matchOf(PUBLIC_ID, search.patient),
    invoice: matchOf(PUBLIC_ID, search.invoice),
    from: textOf(search.from) || undefined,
  };
}

/**
 * A supplier bill in the URL: its purchase's public id — `mpo_…` (a Medical PO) or `spur_…` (a
 * Clinic stock purchase); the prefix names the kind (`supplierBillRefOf`).
 */
const BILL_PARAM = /^(?:mpo|spur)_[a-z0-9]{21}$/;

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
    branch: matchOf(PUBLIC_ID, search.branch),
  };
}
