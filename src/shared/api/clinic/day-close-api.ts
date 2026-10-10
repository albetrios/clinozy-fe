import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import { addCivilDays, clinicInstant, clinicToday } from './clinic-time.ts';
import {
  type AcceptOpeningInput,
  type CloseDayInput,
  type DayCloseHistoryItem,
  type DayCloseRecord,
  dayCloseRowWire,
  type DayCloseState,
  type DayCloseView,
  dayCloseWire,
  type DayOpening,
  type DayOpenItem,
  type ReopenDayInput,
  toDayCloseRecord,
} from './day-close-contracts.ts';
import { fetchLedgerTeam, listDayPayments } from './payments-api.ts';
import type { LedgerPerson } from './payments-contracts.ts';

/*
 * Day close on clinozy-be (`/app/day-closes`, api-integration §5.8; B25–B27): one branch-day as
 * the drawer draws it — the day's record (none until the opening is accepted), its entries, the
 * branch's other open days and its last closes, every figure the server's — and the three steps:
 * accept the opening cash (carried, or recounted), close on the count (a difference needs its
 * reason), reopen with why. Closing locks the day's money. Every key carries the organization;
 * every write carries the action's key.
 */

/** TanStack Query keys for Day close — all under `['clinic', 'day-close']`, each carrying the organization. */
export const dayCloseQueryKeys = {
  all: ['clinic', 'day-close'] as const,
  /** One branch-day's view. */
  day: (organizationId: string | null, branchId: string, date: string) =>
    [...dayCloseQueryKeys.all, organizationId, 'day', branchId, date] as const,
};

/** How many closes "Previous closes" lists (`payments.md:276`). */
const HISTORY_SIZE = 6;

/** The most open days the bar lists. */
const OPEN_DAYS_LIMIT = 20;

const HOUR_MS = 3_600_000;

/**
 * The midnight the worker closes a day left open: the end of the day after it (B26) — a past
 * open day's "15 h left".
 */
const autoCloseAt = (day: string) => clinicInstant(addCivilDays(day, 2), '00:00');

/** Whole hours from now to an instant, at least 0. */
const hoursUntil = (instant: string) =>
  Math.max(0, Math.ceil((Date.parse(instant) - Date.now()) / HOUR_MS));

/** One branch's closes as the query reads them. */
async function readCloses(query: {
  branch_id: string;
  close_date_from?: string;
  close_date_to?: string;
  status?: 'open' | 'closed';
  sort?: 'close_date';
  order?: 'asc' | 'desc';
  limit: number;
}): Promise<DayCloseRecord[]> {
  const response = await api.get('/app/day-closes', { query });
  return z
    .array(dayCloseRowWire)
    .parse(response.data ?? [])
    .map(toDayCloseRecord);
}

/** The last close before a day — what accepting its opening would carry (none: a first day, ₹0). */
async function carriedInto(
  branchId: string,
  date: string,
  history: readonly DayCloseRecord[],
): Promise<DayCloseRecord | null> {
  const before = history.find((close) => close.date < date);
  if (before || history.length <= HISTORY_SIZE) return before ?? null;
  const [last] = await readCloses({
    branch_id: branchId,
    status: 'closed',
    close_date_to: addCivilDays(date, -1),
    sort: 'close_date',
    order: 'desc',
    limit: 1,
  });
  return last ?? null;
}

/** The state the record says: none → the gate; open → the working day; closed → the report. */
function stateOf(close: DayCloseRecord | null): DayCloseState {
  if (!close) return 'gate';
  return close.status === 'closed' ? 'closed' : 'open';
}

/** The opening as it is, or — at the gate — what accepting it would carry. */
function openingOf(
  close: DayCloseRecord | null,
  carried: DayCloseRecord | null,
): DayOpening {
  if (close) {
    return {
      cash: close.openingCash,
      source: close.openingSource,
      from: close.openingSource === 'carried' ? (carried?.date ?? null) : null,
    };
  }
  return {
    cash: carried?.countedCash ?? 0,
    source: 'carried',
    from: carried?.date ?? null,
  };
}

/** Who a membership id is, from the team directory; null when unset or gone. */
type PersonOf = (id: string | null) => LedgerPerson | null;

/** The figures a day's record carries — zeros and nulls at the gate, before there is one. */
function closeFiguresOf(
  close: DayCloseRecord | null,
  personOf: PersonOf,
): Pick<
  DayCloseView,
  | 'openingAcceptedAt'
  | 'acceptedBy'
  | 'cashIn'
  | 'cashOut'
  | 'expectedCash'
  | 'countedCash'
  | 'difference'
  | 'differenceReason'
  | 'closedAt'
  | 'closedBy'
  | 'autoClosed'
  | 'netByMode'
  | 'staff'
  | 'events'
> {
  if (!close) {
    return {
      openingAcceptedAt: null,
      acceptedBy: null,
      cashIn: 0,
      cashOut: 0,
      expectedCash: null,
      countedCash: null,
      difference: null,
      differenceReason: null,
      closedAt: null,
      closedBy: null,
      autoClosed: false,
      netByMode: { cash: 0, upi: 0, card: 0, credit: 0 },
      staff: [],
      events: [],
    };
  }
  return {
    openingAcceptedAt: close.openingAcceptedAt,
    acceptedBy: personOf(close.openingAcceptedById),
    cashIn: close.cashIn,
    cashOut: close.cashOut,
    expectedCash: close.expectedCash,
    countedCash: close.countedCash,
    difference: close.difference,
    differenceReason: close.differenceReason,
    closedAt: close.closedAt,
    closedBy: personOf(close.closedById),
    autoClosed: close.closeKind === 'auto',
    netByMode: close.netByMode,
    staff: close.byMember.map((total) => ({
      ...total,
      person: personOf(total.membershipId),
    })),
    events: close.events.map((event) => ({ ...event, by: personOf(event.membershipId) })),
  };
}

/** The branch's other open past days, each with the hours before the worker closes it. */
function openDaysOf(
  open: readonly DayCloseRecord[],
  date: string,
  today: string,
): DayOpenItem[] {
  return open
    .filter((row) => row.date !== date && row.date < today)
    .map((row) => ({
      closeId: row.id,
      date: row.date,
      hoursLeft: hoursUntil(autoCloseAt(row.date)),
    }));
}

/** "Previous closes": the last six closes other than the day itself. */
function historyOf(
  history: readonly DayCloseRecord[],
  date: string,
  personOf: PersonOf,
): DayCloseHistoryItem[] {
  return history
    .filter((row) => row.date !== date)
    .slice(0, HISTORY_SIZE)
    .map((row) => ({
      closeId: row.id,
      date: row.date,
      countedCash: row.countedCash,
      difference: row.difference,
      autoClosed: row.closeKind === 'auto',
      closedBy: personOf(row.closedById),
    }));
}

/**
 * One branch-day as Day close draws it: the day's record and its entries (newest first), the
 * branch's other open past days (the worker closes each at the end of the day after it) and its
 * last six closes — four reads and the team, every figure the server's. At the gate the opening
 * is what accepting it would carry: the last close's count before the day, or ₹0.
 */
export async function fetchDayClose(
  branchId: string,
  date: string,
): Promise<DayCloseView> {
  const today = clinicToday();
  const [days, history, open, entries, team] = await Promise.all([
    readCloses({
      branch_id: branchId,
      close_date_from: date,
      close_date_to: date,
      limit: 1,
    }),
    readCloses({
      branch_id: branchId,
      status: 'closed',
      sort: 'close_date',
      order: 'desc',
      limit: HISTORY_SIZE + 1,
    }),
    readCloses({
      branch_id: branchId,
      status: 'open',
      sort: 'close_date',
      order: 'asc',
      limit: OPEN_DAYS_LIMIT,
    }),
    listDayPayments(branchId, date),
    fetchLedgerTeam(),
  ]);
  const close = days[0] ?? null;
  const carried = await carriedInto(branchId, date, history);
  const personOf: PersonOf = (id) => (id === null ? null : (team.get(id) ?? null));
  const state = stateOf(close);
  return {
    branchId,
    date,
    today,
    state,
    close,
    opening: openingOf(close, carried),
    ...closeFiguresOf(close, personOf),
    autoClosesInHours:
      state === 'open' && date < today ? hoursUntil(autoCloseAt(date)) : null,
    canReopen: state === 'closed',
    entries,
    collectedCount: entries.filter((row) => row.direction === 'received').length,
    paidOutCount: entries.filter((row) => row.direction === 'paid').length,
    openDays: openDaysOf(open, date, today),
    history: historyOf(history, date, personOf),
  };
}

// ── Writes ──

/**
 * Accept a day's opening cash (`POST /app/day-closes`, `payment:update`): the carried amount
 * (the last close's count), or the recount typed at the gate. `409 record_already_exists` once
 * the day was opened; a day after today or more than 120 days back is a 400.
 */
export async function acceptOpeningCash({
  input,
  idempotencyKey,
}: {
  input: AcceptOpeningInput;
  idempotencyKey: string;
}): Promise<DayCloseRecord> {
  const response = await api.post('/app/day-closes', {
    body: {
      branch_id: input.branchId,
      close_date: input.date,
      ...(input.recount === null
        ? { opening_source: 'carried' as const }
        : { opening_source: 'recounted' as const, opening_cash: input.recount }),
    },
    idempotencyKey,
  });
  return toDayCloseRecord(dayCloseWire.parse(response.data));
}

/**
 * Close a day on the counted cash (`POST …/close`, `payment:update`) — a count that differs from
 * the expected needs its reason (400). The day's money locks.
 */
export async function closeDay({
  input,
  idempotencyKey,
}: {
  input: CloseDayInput;
  idempotencyKey: string;
}): Promise<DayCloseRecord> {
  const reason = input.differenceReason?.trim();
  const response = await api.post('/app/day-closes/{day_close_id}/close', {
    params: { day_close_id: input.closeId },
    body: {
      counted_cash: input.countedCash,
      ...(reason ? { difference_reason: reason } : {}),
    },
    idempotencyKey,
  });
  return toDayCloseRecord(dayCloseWire.parse(response.data));
}

/**
 * Reopen a closed day with why (`POST …/reopen`, `payment:delete`) — the count is cleared and the
 * next close recomputes; `409 transition_not_allowed` for an open day.
 */
export async function reopenDay({
  input,
  idempotencyKey,
}: {
  input: ReopenDayInput;
  idempotencyKey: string;
}): Promise<DayCloseRecord> {
  const response = await api.post('/app/day-closes/{day_close_id}/reopen', {
    params: { day_close_id: input.closeId },
    body: { reason: input.reason.trim() },
    idempotencyKey,
  });
  return toDayCloseRecord(dayCloseWire.parse(response.data));
}
