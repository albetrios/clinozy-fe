import { z } from 'zod';

import type { DayModeTotals } from './clinic-money.ts';
import { dayCloseSchema, OPENING_SOURCE_VALUES } from './clinic-schema.ts';
import type { LedgerPerson, LedgerRow } from './payments-contracts.ts';

/*
 * The Day close domain as the Payments room reads it (KICKOFF §6.9 Day close;
 * `S:699–715`): the contract's `DayClose` with the plan's fields (Appendix F,
 * REPLACE_WITH_API) and the view the drawer draws — the day's state, its cash,
 * its entries and the closes before it.
 */

/**
 * Where a day's opening cash came from: the contract's two (`S:1421–1425`) and
 * the plan's "Recounted" (Appendix F) — a count typed at the gate.
 */
const DAY_OPENING_SOURCE_VALUES = [...OPENING_SOURCE_VALUES, 'recounted'] as const;

/** An opening cash's source. */
type DayOpeningSource = (typeof DAY_OPENING_SOURCE_VALUES)[number];

/**
 * A branch-day close: the contract's fields with the plan's — the recount
 * source, who accepted the opening cash, and the entries ticked in the review
 * ("Mark as checked", a server mutation, C26).
 */
export const dayCloseRecordSchema = dayCloseSchema.extend({
  openingSource: z.enum(DAY_OPENING_SOURCE_VALUES),
  openingAcceptedById: z.uuid().nullable(),
  checkedPaymentIds: z.array(z.uuid()),
});

/** A Day close record — the contract's fields and the plan's. */
export type DayCloseRecord = z.infer<typeof dayCloseRecordSchema>;

/**
 * The states run in order (`S:715`): no accepted opening → the gate; accepted,
 * no close → open (the working day); closed → the report.
 */
export type DayCloseState = 'gate' | 'open' | 'closed';

/** A day's opening cash: what it is (or would be), where it came from, and the close it carried from. */
export interface DayOpening {
  cash: number;
  source: DayOpeningSource;
  /** The day of the close it was carried from ("Carried from 2 Oct close"). */
  from: string | null;
}

/** Money one way on the day: the sum and how many entries. */
interface DayFlow {
  amount: number;
  count: number;
}

/** A member's receipts on the day — a staff chip ("Farah A. · 1 receipt · ₹600"). */
export interface DayStaffTotal {
  person: LedgerPerson;
  receipts: number;
  amount: number;
}

/** A past day still open — the bar's butter chip ("2 Oct not closed · 15 h left"). */
export interface DayOpenItem {
  date: string;
  hoursLeft: number;
}

/** A close before the reviewed day — a "Previous closes" chip. */
export interface DayCloseHistoryItem {
  date: string;
  countedCash: number;
  /** Counted less expected; 0 is a matched drawer. */
  difference: number;
  /** Closed by the server's job after the grace period, not a person. */
  autoClosed: boolean;
  closedBy: LedgerPerson | null;
}

/**
 * One branch-day as Day close draws it (REPLACE_WITH_API — the server derives
 * the state, the totals and the expected cash; `S:715`): its opening, who
 * accepted it and when, the count, who closed it and when, its entries newest
 * first with their totals by mode (Q-G5), the staff behind the receipts, the
 * entries ticked in the review, the open days and the last six closes.
 */
export interface DayCloseView {
  branchId: string;
  date: string;
  /** The clinic's today, as the server counts it. */
  today: string;
  state: DayCloseState;
  opening: DayOpening;
  openingAcceptedAt: string | null;
  acceptedBy: LedgerPerson | null;
  /** The drawer's count once closed (the expected cash when the job closed it). */
  countedCash: number | null;
  closedAt: string | null;
  closedBy: LedgerPerson | null;
  /** A closed day with no closer: the job closed it, the cash taken as expected. */
  autoClosed: boolean;
  /** Hours until a past open day closes itself; null for today and closed days. */
  autoClosesInHours: number | null;
  /** Reopening is possible: a closed day still inside the grace period (Q-G1). */
  canReopen: boolean;
  /** The entries ticked "Mark as checked". */
  checkedIds: string[];
  entries: LedgerRow[];
  totals: DayModeTotals;
  expectedCash: number;
  collected: DayFlow;
  paidOut: DayFlow;
  staff: DayStaffTotal[];
  openDays: DayOpenItem[];
  history: DayCloseHistoryItem[];
}

/** A branch-day — what every Day close write names. */
export interface DayKey {
  branchId: string;
  date: string;
}

/** Accept the opening cash: the suggested amount, or the recount typed at the gate. */
export interface AcceptOpeningInput extends DayKey {
  /** The recount in paise; null accepts the suggested opening. */
  recount: number | null;
}

/** Close a day on the counted cash (`closeDay`, `S:1715`). */
export interface CloseDayInput extends DayKey {
  countedCash: number;
}

/** Tick or untick an entry in the review ("Mark as checked"). */
export interface EntryCheckInput extends DayKey {
  paymentId: string;
  checked: boolean;
}
