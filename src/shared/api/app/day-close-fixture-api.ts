import { appDateOf } from './app-filter-match.ts';
import { appHttpError, compareText } from './app-fixture-store.ts';
import { dayModeTotals, expectedDrawerCash } from './app-money.ts';
import type { DayClose } from './app-schema.ts';
import { addCivilDays, appInstant, appToday } from './app-time.ts';
import type { DayCloseRecord, PaymentRecord } from './payments-fixture-contracts.ts';

/*
 * The fixture world's day lock — what the rooms still on fixtures (the parked Medical room, the
 * fixture invoices server) need of Day close: the clinic day an entry counts on, the auto-close
 * job that locks the days left open, and the 409 a write to a closed day answers. The Payments
 * room's Day close reads clinozy-be (`day-close-api.ts`); this goes with the last fixture room
 * that writes money.
 */

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['appFixtures'];

/** The opening cash of a branch's first fixture close: ₹2,000 (H:5086). */
const DEFAULT_OPENING_FLOAT = 200_000;

const DAY_CLOSED = 'Day closed';

/** The clinic day an entry counts on: the calendar date of `paidAt`, clinic time. */
export function ledgerDayOf(payment: Pick<PaymentRecord, 'paidAt'>): string {
  return appDateOf(payment.paidAt);
}

/** A branch's opening cash for a day: the counted cash of the last close before it, else the float. */
function openingCashFor(
  closes: readonly Pick<DayClose, 'branchId' | 'date' | 'closedAt' | 'countedCash'>[],
  branchId: string,
  day: string,
): { cash: number; source: DayCloseRecord['openingSource'] } {
  const before = closes
    .filter(
      (close) =>
        close.branchId === branchId &&
        close.date < day &&
        close.closedAt !== null &&
        close.countedCash !== null,
    )
    .sort((a, b) => compareText(b.date, a.date))[0];
  if (before?.countedCash == null) {
    return { cash: DEFAULT_OPENING_FLOAT, source: 'default_float' };
  }
  return { cash: before.countedCash, source: 'carried' };
}

/** The midnight a day closes itself: the end of the grace day after it (Q-G2). */
const autoCloseAt = (day: string) => appInstant(addCivilDays(day, 2), '00:00');

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

/** One branch-day the job closes. */
interface OpenDay {
  branchId: string;
  day: string;
}

/** The past days before `yesterday` left open, oldest first. */
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
) {
  if (record?.openingAcceptedAt || record?.closedAt) {
    return { cash: record.openingCash, source: record.openingSource };
  }
  return openingCashFor(world.dayCloses.snapshot(), branchId, day);
}

/**
 * The fixture auto-close job (Q-G2): a day left open closes itself at the midnight after the
 * grace day, the cash taken as expected — each past open day gets its close and its entries take
 * the close's id. Idempotent; the fixture money reads and writes run it first.
 */
export async function runDayCloseJob(today: string = appToday()): Promise<void> {
  const { appFixtures: world } = await fixtureWorld();
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

/** Whether a branch's fixture day is closed (a close with `closedAt` set). */
export async function isDayClosed(branchId: string, day: string): Promise<boolean> {
  const { appFixtures: world } = await fixtureWorld();
  return recordOf(world, branchId, day)?.closedAt != null;
}

/**
 * Refuse a fixture write to a closed day the way clinozy-be does (`conflict`): a 409 whose
 * detail names the entry ("PAY-5509 · Day closed") or the day.
 */
export async function assertDayOpen(
  branchId: string,
  day: string,
  detail = DAY_CLOSED,
): Promise<void> {
  await runDayCloseJob();
  if (await isDayClosed(branchId, day)) {
    throw appHttpError(409, 'conflict', detail);
  }
}
