import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import { civilDateSchema, type PaymentMode } from './app-schema.ts';
import type { LedgerPerson, LedgerRow } from './payments-contracts.ts';

/*
 * Day close on clinozy-be (`/app/day-closes`, api-integration §5.8; B25–B27): one branch's day of
 * cash — its opening (carried from the last close, or recounted), the cash in and out, the
 * expected and counted cash and their difference, how and when it closed, the net by mode, each
 * member's entries, and what happened (opened, recounted, closed, auto-closed, reopened). The
 * server computes every figure; closing locks the day's money. Money is rupees as the API sends
 * it.
 */

// ── Records ──

/** A day's status — `open` from the accepted opening, `closed` once counted (or auto-closed). */
const DAY_CLOSE_STATUS_VALUES = ['open', 'closed'] as const;
/** One day status. */
type DayCloseStatus = (typeof DAY_CLOSE_STATUS_VALUES)[number];

/** Where a day's opening cash came from: the last close's count, or a recount at the gate. */
const DAY_OPENING_SOURCE_VALUES = ['carried', 'recounted'] as const;
/** An opening cash's source. */
type DayOpeningSource = (typeof DAY_OPENING_SOURCE_VALUES)[number];

/** How a day closed: by a person, or by the auto-close worker at the end of the next day (B26). */
const DAY_CLOSE_KIND_VALUES = ['manual', 'auto'] as const;

/** What happened to a day (B27). */
const DAY_CLOSE_EVENT_KIND_VALUES = [
  'opened',
  'recounted',
  'closed',
  'auto_closed',
  'reopened',
] as const;
/** One event kind. */
type DayCloseEventKind = (typeof DAY_CLOSE_EVENT_KIND_VALUES)[number];

/**
 * One step of a day. Render by `kind` and the day's figures; `text` is the server's English log
 * line — a reopen's is the reason as typed (D81 PAY-M4).
 */
interface DayCloseEvent {
  id: string;
  kind: DayCloseEventKind;
  text: string | null;
  /** Who did it (`mem_…`); null for the worker. */
  membershipId: string | null;
  at: string;
}

/** A member's entries on the day: how many and their net (rupees). */
interface DayCloseMemberTotal {
  /** `mem_…`; null for entries an API key wrote. */
  membershipId: string | null;
  count: number;
  amount: number;
}

/** One branch-day as the server keeps it. Money in rupees. */
export interface DayCloseRecord {
  /** `dcl_…`. */
  id: string;
  branchId: string;
  date: string;
  status: DayCloseStatus;
  openingCash: number;
  openingSource: DayOpeningSource;
  openingAcceptedAt: string;
  openingAcceptedById: string | null;
  cashIn: number;
  cashOut: number;
  /** The opening plus the cash in less the cash out — live while open, the close's once closed. */
  expectedCash: number | null;
  countedCash: number | null;
  /** Counted less expected; 0 is a matched drawer. */
  difference: number | null;
  differenceReason: string | null;
  closeKind: 'manual' | 'auto' | null;
  closedAt: string | null;
  closedById: string | null;
  /** The day's net in each mode (Q-G5). */
  netByMode: Readonly<Record<PaymentMode, number>>;
  byMember: DayCloseMemberTotal[];
  entryCount: number;
  events: DayCloseEvent[];
  createdAt: string;
  updatedAt: string;
}

// ── The wire ──

type ApiDayCloseRow = NonNullable<ApiData<'/app/day-closes', 'get'>>[number];
type ApiDayClose = NonNullable<ApiData<'/app/day-closes/{day_close_id}', 'get'>>;

const dayCloseFieldsWire = {
  id: z.string(),
  branch_id: z.string(),
  close_date: civilDateSchema,
  status: z.enum(DAY_CLOSE_STATUS_VALUES),
  opening_cash: z.number(),
  opening_source: z.enum(DAY_OPENING_SOURCE_VALUES),
  opening_accepted_at: z.string(),
  opening_accepted_by_membership_id: z.string().nullable(),
  cash_in: z.number(),
  cash_out: z.number(),
  expected_cash: z.number().nullable(),
  counted_cash: z.number().nullable(),
  difference: z.number().nullable(),
  difference_reason: z.string().nullable(),
  close_kind: z.enum(DAY_CLOSE_KIND_VALUES).nullable(),
  closed_at: z.string().nullable(),
  closed_by_membership_id: z.string().nullable(),
  net_by_mode: z.object({
    cash: z.number(),
    upi: z.number(),
    card: z.number(),
    credit: z.number(),
  }),
  by_member: z.array(
    z.object({
      membership_id: z.string().nullable(),
      count: z.number().int(),
      amount: z.number(),
    }),
  ),
  entry_count: z.number().int(),
  events: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(DAY_CLOSE_EVENT_KIND_VALUES),
      text: z.string().nullable(),
      membership_id: z.string().nullable(),
      occurred_at: z.string(),
    }),
  ),
  created_at: z.string(),
  updated_at: z.string(),
};

/** A day-close list row (`GET /app/day-closes`). */
export const dayCloseRowWire = wireSchema<ApiDayCloseRow>()(z.object(dayCloseFieldsWire));

/** One day close (`GET /app/day-closes/:day_close_id`, and every write's answer). */
export const dayCloseWire = wireSchema<ApiDayClose>()(z.object(dayCloseFieldsWire));

/** A day close as the rooms read it. */
export function toDayCloseRecord(row: z.output<typeof dayCloseRowWire>): DayCloseRecord {
  return {
    id: row.id,
    branchId: row.branch_id,
    date: row.close_date,
    status: row.status,
    openingCash: row.opening_cash,
    openingSource: row.opening_source,
    openingAcceptedAt: row.opening_accepted_at,
    openingAcceptedById: row.opening_accepted_by_membership_id,
    cashIn: row.cash_in,
    cashOut: row.cash_out,
    expectedCash: row.expected_cash,
    countedCash: row.counted_cash,
    difference: row.difference,
    differenceReason: row.difference_reason,
    closeKind: row.close_kind,
    closedAt: row.closed_at,
    closedById: row.closed_by_membership_id,
    netByMode: row.net_by_mode,
    byMember: row.by_member.map((total) => ({
      membershipId: total.membership_id,
      count: total.count,
      amount: total.amount,
    })),
    entryCount: row.entry_count,
    events: row.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      text: event.text,
      membershipId: event.membership_id,
      at: event.occurred_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── The view ──

/**
 * The states run in order: no accepted opening → the gate; accepted, not closed → open (the
 * working day); closed → the report.
 */
export type DayCloseState = 'gate' | 'open' | 'closed';

/**
 * A day's opening cash: what it is — or, at the gate, what accepting it would carry (the last
 * close's count before the day, 0 for a branch's first) — where it came from, and the day of the
 * close it was carried from ("Carried from 2 Oct close").
 */
export interface DayOpening {
  cash: number;
  source: DayOpeningSource;
  from: string | null;
}

/** A member's entries on the day — a staff chip ("Farah A. · 3 entries · ₹600"). */
interface DayStaffTotal extends DayCloseMemberTotal {
  person: LedgerPerson | null;
}

/** A step of the day, with who did it. */
interface DayEvent extends DayCloseEvent {
  by: LedgerPerson | null;
}

/** Another day of the branch still open — the bar's butter chip ("2 Oct not closed · 15 h left"). */
export interface DayOpenItem {
  closeId: string;
  date: string;
  /** Hours until the worker closes it (the end of the day after it, B26). */
  hoursLeft: number;
}

/** A close before (or after) the reviewed day — a "Previous closes" chip. */
export interface DayCloseHistoryItem {
  closeId: string;
  date: string;
  countedCash: number | null;
  /** Counted less expected (the server's); 0 is a matched drawer. */
  difference: number | null;
  /** Closed by the worker, not a person. */
  autoClosed: boolean;
  closedBy: LedgerPerson | null;
}

/**
 * One branch-day as Day close draws it — every figure the server's: the state, the opening, who
 * accepted it and when, the cash in and out, the expected and counted cash and the difference,
 * who closed it and how, the net by mode, the staff, the steps, its entries newest first, how
 * many came in and went out, the branch's other open days and its last closes.
 */
export interface DayCloseView {
  branchId: string;
  date: string;
  /** The clinic's today. */
  today: string;
  state: DayCloseState;
  /** The server's record; null at the gate. */
  close: DayCloseRecord | null;
  opening: DayOpening;
  openingAcceptedAt: string | null;
  acceptedBy: LedgerPerson | null;
  cashIn: number;
  cashOut: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  differenceReason: string | null;
  closedAt: string | null;
  closedBy: LedgerPerson | null;
  /** Closed by the worker, the count taken as expected. */
  autoClosed: boolean;
  /** Hours until an open past day closes itself; null for today and closed days. */
  autoClosesInHours: number | null;
  /** A closed day can be reopened (`payment:delete`); the count is cleared. */
  canReopen: boolean;
  netByMode: Readonly<Record<PaymentMode, number>>;
  staff: DayStaffTotal[];
  events: DayEvent[];
  entries: LedgerRow[];
  /** How many of the entries took money in, and how many paid it out. */
  collectedCount: number;
  paidOutCount: number;
  openDays: DayOpenItem[];
  history: DayCloseHistoryItem[];
}

/** A branch-day — what the view reads. */
interface DayKey {
  branchId: string;
  date: string;
}

/** Accept the opening cash: the carried amount, or the recount typed at the gate (rupees). */
export interface AcceptOpeningInput extends DayKey {
  /** The recount; null accepts the carried opening. */
  recount: number | null;
}

/** Close a day on the counted cash, with the reason when it differs from the expected. */
export interface CloseDayInput {
  closeId: string;
  countedCash: number;
  differenceReason: string | null;
}

/** Reopen a closed day, with why (kept on its `reopened` step). */
export interface ReopenDayInput {
  closeId: string;
  reason: string;
}
