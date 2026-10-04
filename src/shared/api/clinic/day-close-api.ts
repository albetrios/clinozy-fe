import { clinicDateOf } from './clinic-filter-match.ts';
import { clinicHttpError, compareText } from './clinic-fixture-store.ts';
import { dayModeTotals, expectedDrawerCash } from './clinic-money.ts';
import type { DayClose, OpeningSource } from './clinic-schema.ts';
import { addCivilDays, clinicInstant, clinicToday } from './clinic-time.ts';
import type { PaymentRecord } from './payments-contracts.ts';

/*
 * The Day close domain (`S:699–715`, `S:1714–1715`) on the fixture world until
 * clinozy-be serves it — every call is REPLACE_WITH_API (D6). The world is
 * imported on demand, so its seed data never lands in a route chunk. Every
 * money read and write first runs the auto-close job, so the ledger's lock is
 * the server's (`dayCloseId`, `S:662`).
 */

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/**
 * The opening cash of a branch's first close — the default float, an
 * organization setting (Appendix F): ₹2,000 (H:5086).
 */
export const DEFAULT_OPENING_FLOAT = 200_000;

/** The clinic day an entry counts on: the calendar date of `paidAt`, clinic time. */
export function ledgerDayOf(payment: Pick<PaymentRecord, 'paidAt'>): string {
  return clinicDateOf(payment.paidAt);
}

/**
 * A branch's opening cash for a day (`S:705`): the counted cash of the last
 * close before it ("Carried from 2 Oct close"), else the default float.
 */
export function openingCashFor(
  closes: readonly DayClose[],
  branchId: string,
  day: string,
): { cash: number; source: OpeningSource; from: string | null } {
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

/** One branch-day the job closes: its key, the branch and the date. */
interface OpenDay {
  branchId: string;
  day: string;
}

/** The past days before `yesterday` with entries but no close, oldest first. */
function daysToClose(world: FixtureWorld, yesterday: string): OpenDay[] {
  const closed = new Set(
    world.dayCloses.snapshot().map((close) => `${close.branchId}|${close.date}`),
  );
  const days = new Map<string, OpenDay>();
  for (const payment of world.payments.snapshot(
    (row) => row.dayCloseId === null && ledgerDayOf(row) < yesterday,
  )) {
    const day = ledgerDayOf(payment);
    const key = `${payment.branchId}|${day}`;
    if (!closed.has(key)) days.set(key, { branchId: payment.branchId, day });
  }
  return [...days.values()].sort((a, b) => compareText(a.day, b.day));
}

/**
 * The auto-close job (Q-G2; the server's, REPLACE_WITH_API): a day left open
 * closes itself at the midnight after the grace day, the cash taken as expected
 * — so only today and yesterday can be open. Each past day with entries but no
 * close gets one (no opening accepted, counted = expected, no closer), and its
 * entries take its `dayCloseId`. Idempotent; run before every money read.
 */
export async function runDayCloseJob(today: string = clinicToday()): Promise<void> {
  const { clinicFixtures: world } = await fixtureWorld();
  const yesterday = addCivilDays(today, -1);
  for (const { branchId, day } of daysToClose(world, yesterday)) {
    const entries = world.payments.snapshot(
      (row) => row.branchId === branchId && ledgerDayOf(row) === day,
    );
    const opening = openingCashFor(world.dayCloses.snapshot(), branchId, day);
    const close = await world.dayCloses.create({
      branchId,
      date: day,
      openingCash: opening.cash,
      openingSource: opening.source,
      openingAcceptedAt: null,
      countedCash: expectedDrawerCash(opening.cash, dayModeTotals(entries)),
      closedAt: clinicInstant(addCivilDays(day, 2), '00:00'),
      closedById: null,
    });
    for (const entry of entries) {
      if (entry.dayCloseId === null) {
        await world.payments.update(entry.id, { dayCloseId: close.id }, { stamp: false });
      }
    }
  }
}

/** Whether a branch's day is closed (a close with `closedAt` set). */
export async function isDayClosed(branchId: string, day: string): Promise<boolean> {
  const { clinicFixtures: world } = await fixtureWorld();
  return (
    world.dayCloses.snapshot(
      (close) =>
        close.branchId === branchId && close.date === day && close.closedAt !== null,
    ).length > 0
  );
}

/**
 * Refuse a write to a closed day the way clinozy-be does (`conflict`, `S:1708`):
 * a 409 whose detail names the entry ("PAY-5509 · Day closed") or the day.
 */
export async function assertDayOpen(
  branchId: string,
  day: string,
  detail = 'Day closed',
): Promise<void> {
  await runDayCloseJob();
  if (await isDayClosed(branchId, day)) {
    throw clinicHttpError(409, 'conflict', detail);
  }
}
