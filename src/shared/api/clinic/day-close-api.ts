import { clinicDateOf } from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CreateInput,
} from './clinic-fixture-store.ts';
import { dayModeTotals, expectedDrawerCash } from './clinic-money.ts';
import type { DayClose } from './clinic-schema.ts';
import { addCivilDays, clinicInstant, clinicToday } from './clinic-time.ts';
import type {
  AcceptOpeningInput,
  CloseDayInput,
  DayCloseHistoryItem,
  DayCloseRecord,
  DayCloseState,
  DayCloseView,
  DayKey,
  DayOpening,
  DayOpenItem,
  DayStaffTotal,
  EntryCheckInput,
} from './day-close-contracts.ts';
import { type LedgerContext, ledgerContext, toLedgerRow } from './ledger-rows.ts';
import type { LedgerPerson, LedgerRow, PaymentRecord } from './payments-contracts.ts';

/*
 * The Day close domain (`S:699–715`, `S:1714–1715`) on the fixture world until
 * clinozy-be serves it — every call is REPLACE_WITH_API (D6). The world is
 * imported on demand, so its seed data never lands in a route chunk. Every
 * money read and write first runs the auto-close job, so the ledger's lock is
 * the server's (`dayCloseId`, `S:662`).
 */

/** TanStack Query keys for Day close — all under `['clinic', 'day-close']`. */
export const dayCloseQueryKeys = {
  all: ['clinic', 'day-close'] as const,
  /** One branch-day's view. */
  day: (branchId: string, date: string) =>
    [...dayCloseQueryKeys.all, 'day', branchId, date] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/**
 * The opening cash of a branch's first close — the default float, an
 * organization setting (Appendix F): ₹2,000 (H:5086).
 */
export const DEFAULT_OPENING_FLOAT = 200_000;

/** How many closes "Previous closes" lists (`payments.md:276`). */
const HISTORY_SIZE = 6;

const HOUR_MS = 3_600_000;

const DAY_CLOSED = 'Day closed';
const DAY_OPEN = 'Day is open';
const ACCEPT_FIRST = 'Accept the opening cash first';
const ALREADY_ACCEPTED = 'Opening cash already accepted';
const PAST_GRACE = 'Past the grace period';
const COUNT_FIRST = 'Count the cash first';
const FUTURE_DAY = 'Pick a day up to today';
const NOT_THIS_DAY = 'Not an entry of this day';

/** The clinic day an entry counts on: the calendar date of `paidAt`, clinic time. */
export function ledgerDayOf(payment: Pick<PaymentRecord, 'paidAt'>): string {
  return clinicDateOf(payment.paidAt);
}

/**
 * A branch's opening cash for a day (`S:705`): the counted cash of the last
 * close before it ("Carried from 2 Oct close"), else the default float.
 */
export function openingCashFor(
  closes: readonly Pick<DayClose, 'branchId' | 'date' | 'closedAt' | 'countedCash'>[],
  branchId: string,
  day: string,
): DayOpening {
  const before = closes
    .filter(
      (close) =>
        close.branchId === branchId &&
        close.date < day &&
        close.closedAt !== null &&
        close.countedCash !== null,
    )
    .sort((a, b) => compareText(b.date, a.date))[0];
  if (!before || before.countedCash === null) {
    return { cash: DEFAULT_OPENING_FLOAT, source: 'default_float', from: null };
  }
  return { cash: before.countedCash, source: 'carried', from: before.date };
}

/** The midnight a day closes itself: the end of the grace day after it (Q-G2). */
const autoCloseAt = (day: string) => clinicInstant(addCivilDays(day, 2), '00:00');

/** Whole hours from now to an instant, at least 0 — "15 h left". */
const hoursUntil = (instant: string) =>
  Math.max(0, Math.ceil((Date.parse(instant) - Date.now()) / HOUR_MS));

/** A branch-day's live entries. */
function dayEntries(world: FixtureWorld, branchId: string, day: string): PaymentRecord[] {
  return world.payments.snapshot(
    (row) => row.branchId === branchId && ledgerDayOf(row) === day,
  );
}

/** A branch-day's close record, when one was written. */
function recordOf(
  world: FixtureWorld,
  branchId: string,
  day: string,
): DayCloseRecord | undefined {
  return world.dayCloses.snapshot(
    (close) => close.branchId === branchId && close.date === day,
  )[0];
}

/** Lock the entries on a close — no edit, no delete (`S:662`). */
async function lockEntries(
  world: FixtureWorld,
  entries: readonly PaymentRecord[],
  closeId: string,
): Promise<void> {
  for (const entry of entries) {
    if (entry.dayCloseId === null) {
      await world.payments.update(entry.id, { dayCloseId: closeId }, { stamp: false });
    }
  }
}

/** One branch-day the job closes: the branch and the date. */
interface OpenDay {
  branchId: string;
  day: string;
}

/**
 * The past days before `yesterday` left open, oldest first: those with entries
 * not on a close, and those with a record but no close (an opening accepted, or
 * entries ticked, then never closed).
 */
function daysToClose(world: FixtureWorld, yesterday: string): OpenDay[] {
  const closed = new Set(
    world.dayCloses
      .snapshot((close) => close.closedAt !== null)
      .map((close) => `${close.branchId}|${close.date}`),
  );
  const days = new Map<string, OpenDay>();
  for (const payment of world.payments.snapshot(
    (row) => row.dayCloseId === null && ledgerDayOf(row) < yesterday,
  )) {
    const day = ledgerDayOf(payment);
    const key = `${payment.branchId}|${day}`;
    if (!closed.has(key)) days.set(key, { branchId: payment.branchId, day });
  }
  for (const close of world.dayCloses.snapshot(
    (row) => row.closedAt === null && row.date < yesterday,
  )) {
    days.set(`${close.branchId}|${close.date}`, {
      branchId: close.branchId,
      day: close.date,
    });
  }
  return [...days.values()].sort((a, b) => compareText(a.day, b.day));
}

/** The opening a close keeps: an accepted one as it was, else what it would carry. */
function openingOf(
  world: FixtureWorld,
  record: DayCloseRecord | undefined,
  branchId: string,
  day: string,
): DayOpening {
  const suggested = openingCashFor(world.dayCloses.snapshot(), branchId, day);
  if (!(record?.openingAcceptedAt || record?.closedAt)) return suggested;
  return {
    cash: record.openingCash,
    source: record.openingSource,
    from: record.openingSource === 'carried' ? suggested.from : null,
  };
}

/**
 * The auto-close job (Q-G2; the server's, REPLACE_WITH_API): a day left open
 * closes itself at the midnight after the grace day, the cash taken as expected
 * — so only today and yesterday can be open. Each past open day gets its close
 * (no closer, counted = expected) and its entries take the close's id.
 * Idempotent; run before every money read.
 */
export async function runDayCloseJob(today: string = clinicToday()): Promise<void> {
  const { clinicFixtures: world } = await fixtureWorld();
  const yesterday = addCivilDays(today, -1);
  for (const { branchId, day } of daysToClose(world, yesterday)) {
    const entries = dayEntries(world, branchId, day);
    const record = recordOf(world, branchId, day);
    const opening = openingOf(world, record, branchId, day);
    const fields = {
      openingCash: opening.cash,
      openingSource: opening.source,
      countedCash: expectedDrawerCash(opening.cash, dayModeTotals(entries)),
      closedAt: autoCloseAt(day),
      closedById: null,
    };
    const close = record
      ? await world.dayCloses.update(record.id, fields)
      : await world.dayCloses.create({
          branchId,
          date: day,
          openingAcceptedAt: null,
          openingAcceptedById: null,
          checkedPaymentIds: [],
          ...fields,
        });
    await lockEntries(world, entries, close.id);
  }
}

/** Whether a branch's day is closed (a close with `closedAt` set). */
export async function isDayClosed(branchId: string, day: string): Promise<boolean> {
  const { clinicFixtures: world } = await fixtureWorld();
  return recordOf(world, branchId, day)?.closedAt != null;
}

/**
 * Refuse a write to a closed day the way clinozy-be does (`conflict`, `S:1708`):
 * a 409 whose detail names the entry ("PAY-5509 · Day closed") or the day.
 */
export async function assertDayOpen(
  branchId: string,
  day: string,
  detail = DAY_CLOSED,
): Promise<void> {
  await runDayCloseJob();
  if (await isDayClosed(branchId, day)) {
    throw clinicHttpError(409, 'conflict', detail);
  }
}

// ── The view ──

/** Newest first — `paidAt`, then the newer number (the ledger's order). */
const newestFirst = (a: LedgerRow, b: LedgerRow) =>
  compareText(b.paidAt, a.paidAt) || b.seq - a.seq;

const personOf = (context: LedgerContext, id: string | null): LedgerPerson | null =>
  id === null ? null : (context.staff.get(id) ?? null);

/** The members behind the day's receipts, most collected first. */
function staffTotals(entries: readonly LedgerRow[]): DayStaffTotal[] {
  const totals = new Map<string, DayStaffTotal>();
  for (const row of entries) {
    if (row.direction !== 'received' || !row.by) continue;
    const total = totals.get(row.by.id) ?? { person: row.by, receipts: 0, amount: 0 };
    total.receipts += 1;
    total.amount += row.amount;
    totals.set(row.by.id, total);
  }
  return [...totals.values()].sort(
    (a, b) => b.amount - a.amount || compareText(a.person.name, b.person.name),
  );
}

/** Yesterday, while it is still open with something to close — the bar's chip. */
function openDaysOf(world: FixtureWorld, branchId: string, today: string): DayOpenItem[] {
  const yesterday = addCivilDays(today, -1);
  const record = recordOf(world, branchId, yesterday);
  const pending = record
    ? !record.closedAt
    : dayEntries(world, branchId, yesterday).length > 0;
  return pending
    ? [{ date: yesterday, hoursLeft: hoursUntil(autoCloseAt(yesterday)) }]
    : [];
}

/** The closes before (and after) the reviewed day, newest first, at most six. */
function historyOf(
  world: FixtureWorld,
  context: LedgerContext,
  branchId: string,
  date: string,
): DayCloseHistoryItem[] {
  return world.dayCloses
    .snapshot(
      (close) =>
        close.branchId === branchId &&
        close.date !== date &&
        close.closedAt !== null &&
        close.countedCash !== null,
    )
    .sort((a, b) => compareText(b.date, a.date))
    .slice(0, HISTORY_SIZE)
    .map((close) => {
      const counted = close.countedCash ?? 0;
      const totals = dayModeTotals(dayEntries(world, branchId, close.date));
      return {
        date: close.date,
        countedCash: counted,
        difference: counted - expectedDrawerCash(close.openingCash, totals),
        autoClosed: close.closedById === null,
        closedBy: personOf(context, close.closedById),
      };
    });
}

/** The state the contract derives (`S:715`); a past day with nothing written is closed. */
function stateOf(record: DayCloseRecord | undefined, virtual: boolean): DayCloseState {
  if (virtual || record?.closedAt) return 'closed';
  return record?.openingAcceptedAt ? 'open' : 'gate';
}

/**
 * What the view reads off the record: who accepted the opening and when, the
 * count, who closed it and when, and the ticks. A past day the job had nothing
 * to close (`virtual`) closed at its midnight on the expected cash.
 */
function recordFieldsOf(
  record: DayCloseRecord | undefined,
  context: LedgerContext,
  virtual: { date: string; expectedCash: number } | null,
) {
  return {
    openingAcceptedAt: record?.openingAcceptedAt ?? null,
    acceptedBy: personOf(context, record?.openingAcceptedById ?? null),
    countedCash: virtual ? virtual.expectedCash : (record?.countedCash ?? null),
    closedAt: virtual ? autoCloseAt(virtual.date) : (record?.closedAt ?? null),
    closedBy: personOf(context, record?.closedById ?? null),
    checkedIds: record?.checkedPaymentIds ?? [],
  };
}

/** Money one way on the day. */
function flowOf(entries: readonly LedgerRow[], direction: LedgerRow['direction']) {
  const rows = entries.filter((row) => row.direction === direction);
  return { amount: rows.reduce((sum, row) => sum + row.amount, 0), count: rows.length };
}

/**
 * One branch-day as Day close draws it (REPLACE_WITH_API; `S:699–715`): the
 * state (gate → open → closed), the opening, the count and who did what, the
 * entries newest first with their totals by mode (Q-G5) and the expected cash,
 * the open days and the last six closes. A past day before yesterday that the
 * job had nothing to close (no entries) reads as closed, the cash as expected.
 */
export async function fetchDayClose(
  branchId: string,
  date: string,
): Promise<DayCloseView> {
  await runDayCloseJob();
  const { clinicFixtures: world } = await fixtureWorld();
  const context = await ledgerContext();
  const today = clinicToday();
  const yesterday = addCivilDays(today, -1);
  const record = recordOf(world, branchId, date);
  const virtual = !record && date < yesterday;
  const state = stateOf(record, virtual);
  const payments = dayEntries(world, branchId, date);
  const entries = payments
    .map((payment) => toLedgerRow(payment, context))
    .sort(newestFirst);
  const totals = dayModeTotals(payments);
  const opening = openingOf(world, record, branchId, date);
  const expectedCash = expectedDrawerCash(opening.cash, totals);
  const closed = state === 'closed';
  return {
    branchId,
    date,
    today,
    state,
    opening,
    ...recordFieldsOf(record, context, virtual ? { date, expectedCash } : null),
    autoClosed: closed && !record?.closedById,
    autoClosesInHours: !closed && date < today ? hoursUntil(autoCloseAt(date)) : null,
    canReopen: closed && !virtual && date >= yesterday,
    entries,
    totals,
    expectedCash,
    collected: flowOf(entries, 'received'),
    paidOut: flowOf(entries, 'paid'),
    staff: staffTotals(entries),
    openDays: openDaysOf(world, branchId, today),
    history: historyOf(world, context, branchId, date),
  };
}

// ── Writes ──

/** Refuse a day after today, the way the server's validation does. */
function refuseFuture(date: string, today: string): void {
  if (date > today) {
    throw clinicHttpError(422, 'validation', FUTURE_DAY, { date: [FUTURE_DAY] });
  }
}

/** Refuse a cash amount that is not whole paise at or above zero. */
function refuseBadCash(field: string, paise: number, message: string): void {
  if (!Number.isInteger(paise) || paise < 0) {
    throw clinicHttpError(422, 'validation', message, { [field]: [message] });
  }
}

/** A new record for a branch-day, on the opening it would carry. */
function newRecord(
  world: FixtureWorld,
  key: DayKey,
  fields: Partial<CreateInput<DayCloseRecord>>,
): CreateInput<DayCloseRecord> {
  const opening = openingCashFor(world.dayCloses.snapshot(), key.branchId, key.date);
  return {
    branchId: key.branchId,
    date: key.date,
    openingCash: opening.cash,
    openingSource: opening.source,
    openingAcceptedAt: null,
    openingAcceptedById: null,
    countedCash: null,
    closedAt: null,
    closedById: null,
    checkedPaymentIds: [],
    ...fields,
  };
}

/**
 * Accept a day's opening cash (`acceptOpeningCash`, `S:1714`; REPLACE_WITH_API):
 * the recount when one was typed and differs ("Recounted", Appendix F), else
 * the carried count or the default float — stamped with who and when. The gate
 * opens once: an accepted or closed day is a 409.
 */
export async function acceptOpeningCash(
  input: AcceptOpeningInput,
): Promise<DayCloseRecord> {
  await runDayCloseJob();
  const { clinicFixtures: world } = await fixtureWorld();
  refuseFuture(input.date, clinicToday());
  const record = recordOf(world, input.branchId, input.date);
  if (record?.closedAt) throw clinicHttpError(409, 'conflict', DAY_CLOSED);
  if (record?.openingAcceptedAt) throw clinicHttpError(409, 'conflict', ALREADY_ACCEPTED);
  if (input.recount !== null) refuseBadCash('recount', input.recount, COUNT_FIRST);
  const suggested = openingCashFor(
    world.dayCloses.snapshot(),
    input.branchId,
    input.date,
  );
  const recounted = input.recount !== null && input.recount !== suggested.cash;
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const fields = {
    openingCash: recounted && input.recount !== null ? input.recount : suggested.cash,
    openingSource: recounted ? ('recounted' as const) : suggested.source,
    openingAcceptedAt: new Date().toISOString(),
    openingAcceptedById: FIXTURE_VIEWER_ID,
  };
  return record
    ? world.dayCloses.update(record.id, fields)
    : world.dayCloses.create(newRecord(world, input, fields));
}

/**
 * Close a day on the counted cash (`closeDay`, `S:1715`; REPLACE_WITH_API):
 * the opening must be accepted and the day open; the close is stamped with who
 * and when, and the day's entries lock.
 */
export async function closeDay(input: CloseDayInput): Promise<DayCloseRecord> {
  await runDayCloseJob();
  const { clinicFixtures: world } = await fixtureWorld();
  const record = recordOf(world, input.branchId, input.date);
  if (!record?.openingAcceptedAt) throw clinicHttpError(409, 'conflict', ACCEPT_FIRST);
  if (record.closedAt) throw clinicHttpError(409, 'conflict', DAY_CLOSED);
  refuseBadCash('countedCash', input.countedCash, COUNT_FIRST);
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const close = await world.dayCloses.update(record.id, {
    countedCash: input.countedCash,
    closedAt: new Date().toISOString(),
    closedById: FIXTURE_VIEWER_ID,
  });
  await lockEntries(world, dayEntries(world, input.branchId, input.date), close.id);
  return close;
}

/**
 * Reopen a closed day (Q-G1; plan-only, REPLACE_WITH_API): only inside the
 * grace period — today or yesterday; the count stays, the entries unlock.
 */
export async function reopenDay(input: DayKey): Promise<DayCloseRecord> {
  await runDayCloseJob();
  const { clinicFixtures: world } = await fixtureWorld();
  const record = recordOf(world, input.branchId, input.date);
  if (!record?.closedAt) throw clinicHttpError(409, 'conflict', DAY_OPEN);
  if (input.date < addCivilDays(clinicToday(), -1)) {
    throw clinicHttpError(409, 'conflict', PAST_GRACE);
  }
  const open = await world.dayCloses.update(record.id, {
    closedAt: null,
    closedById: null,
  });
  for (const entry of world.payments.snapshot((row) => row.dayCloseId === record.id)) {
    await world.payments.update(entry.id, { dayCloseId: null }, { stamp: false });
  }
  return open;
}

/**
 * Tick or untick an entry in the review ("Mark as checked" — a server mutation,
 * plan-only, C26; REPLACE_WITH_API). The entry must be the branch-day's.
 */
export async function setEntryChecked(input: EntryCheckInput): Promise<DayCloseRecord> {
  const { clinicFixtures: world } = await fixtureWorld();
  const entry = await world.payments.get(input.paymentId);
  if (entry.branchId !== input.branchId || ledgerDayOf(entry) !== input.date) {
    throw clinicHttpError(422, 'validation', NOT_THIS_DAY, { paymentId: [NOT_THIS_DAY] });
  }
  const record = recordOf(world, input.branchId, input.date);
  const checked = new Set(record?.checkedPaymentIds ?? []);
  if (input.checked) checked.add(input.paymentId);
  else checked.delete(input.paymentId);
  const checkedPaymentIds = [...checked];
  return record
    ? world.dayCloses.update(record.id, { checkedPaymentIds })
    : world.dayCloses.create(newRecord(world, input, { checkedPaymentIds }));
}
