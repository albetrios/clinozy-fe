import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import type { DayClose } from './clinic-schema.ts';
import {
  acceptOpeningCash,
  assertDayOpen,
  closeDay,
  DEFAULT_OPENING_FLOAT,
  fetchDayClose,
  isDayClosed,
  ledgerDayOf,
  openingCashFor,
  reopenDay,
  runDayCloseJob,
  setEntryChecked,
} from './day-close-api.ts';
import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const MAIN = branchRef(MAIN_BRANCH);

const close = (fields: Partial<DayClose>): DayClose => ({
  organizationId: 'org',
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  createdById: 'user',
  deletedAt: null,
  deleteReason: null,
  deleteNote: null,
  id: 'close',
  branchId: MAIN,
  date: '2026-10-01',
  openingCash: 0,
  openingSource: 'carried',
  openingAcceptedAt: null,
  countedCash: 0,
  closedAt: NOW.toISOString(),
  closedById: null,
  ...fields,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('ledgerDayOf', () => {
  it('reads the clinic day of an entry — 23:30 UTC is the next morning in India', () => {
    expect(ledgerDayOf({ paidAt: '2026-10-02T23:30:00Z' })).toBe('2026-10-03');
  });
});

describe('openingCashFor (S:705)', () => {
  it('carries the last closed day’s count, else the default float', () => {
    const closes = [
      close({ id: 'a', date: '2026-09-29', countedCash: 642_000 }),
      close({ id: 'b', date: '2026-09-30', countedCash: 498_000 }),
      close({ id: 'c', date: '2026-10-02', countedCash: null, closedAt: null }),
    ];
    expect(openingCashFor(closes, MAIN, '2026-10-03')).toEqual({
      cash: 498_000,
      source: 'carried',
      from: '2026-09-30',
    });
    expect(openingCashFor(closes, MAIN, '2026-09-29')).toEqual({
      cash: DEFAULT_OPENING_FLOAT,
      source: 'default_float',
      from: null,
    });
    expect(openingCashFor(closes, 'another-branch', '2026-10-03').source).toBe(
      'default_float',
    );
  });
});

describe('runDayCloseJob (Q-G2)', () => {
  it('closes the past days before yesterday and stamps their entries', async () => {
    await runDayCloseJob();
    const stamped = clinicFixtures.payments.snapshot((row) => row.dayCloseId !== null);
    const open = clinicFixtures.payments.snapshot((row) => row.dayCloseId === null);
    expect(open.map((row) => ledgerDayOf(row)).every((day) => day >= '2026-10-02')).toBe(
      true,
    );
    expect(stamped.every((row) => ledgerDayOf(row) < '2026-10-02')).toBe(true);
    // Auto-closed at the midnight after the grace day, no one accepting or closing.
    const auto = clinicFixtures.dayCloses.snapshot((row) => row.date === '2026-09-07')[0];
    expect(auto).toMatchObject({
      openingAcceptedAt: null,
      closedById: null,
      closedAt: '2026-09-08T18:30:00.000Z',
    });
  });
});

describe('isDayClosed / assertDayOpen', () => {
  it('knows a closed day, and refuses a write to it with a conflict', async () => {
    expect(await isDayClosed(MAIN, '2026-10-01')).toBe(true);
    expect(await isDayClosed(MAIN, '2026-10-03')).toBe(false);
    await expect(assertDayOpen(MAIN, '2026-10-03')).resolves.toBeUndefined();
    const error = await assertDayOpen(MAIN, '2026-10-01', 'PAY-305 · Day closed').catch(
      (caught: unknown) => caught,
    );
    expect(isHttpError(error) && error.status).toBe(409);
    expect(isHttpError(error) && error.message).toBe('PAY-305 · Day closed');
  });
});

/** The status a refused write answers with, and its detail. */
async function refusal(write: Promise<unknown>) {
  const error = await write.catch((caught: unknown) => caught);
  return isHttpError(error) ? { status: error.status, message: error.message } : error;
}

const TODAY = '2026-10-03';
const YESTERDAY = '2026-10-02';
const RIYA = staffRef('RS');

describe('fetchDayClose (S:699–715)', () => {
  it('opens today on the gate: the carried count, the entries newest first and their totals by mode', async () => {
    const view = await fetchDayClose(MAIN, TODAY);
    expect(view).toMatchObject({
      date: TODAY,
      today: TODAY,
      state: 'gate',
      opening: { cash: 731_000, source: 'carried', from: '2026-10-01' },
      openingAcceptedAt: null,
      acceptedBy: null,
      countedCash: null,
      closedBy: null,
      autoClosed: false,
      autoClosesInHours: null,
      canReopen: false,
      checkedIds: [],
      expectedCash: 705_000,
      collected: { amount: 545_000, count: 3 },
      paidOut: { amount: 846_000, count: 3 },
    });
    expect(view.entries.map((row) => row.seq)).toEqual([5509, 309, 310, 5513, 5512, 311]);
    expect(view.totals.cash).toEqual({ in: 0, out: 26_000 });
    expect(view.totals.upi).toEqual({ in: 180_000, out: 320_000 });
    // Most collected first: Riya's card receipt, then Farah's two UPI ones.
    expect(
      view.staff.map(({ person, receipts, amount }) => [
        person.initials,
        receipts,
        amount,
      ]),
    ).toEqual([
      ['RS', 1, 365_000],
      ['FA', 2, 180_000],
    ]);
    // Yesterday is still open with entries: its chip, 14 h before midnight.
    expect(view.openDays).toEqual([{ date: YESTERDAY, hoursLeft: 14 }]);
  });

  it('lists the last six closes, newest first, each with its difference', async () => {
    const view = await fetchDayClose(MAIN, TODAY);
    expect(view.history).toHaveLength(6);
    expect(view.history[0]).toMatchObject({
      date: '2026-10-01',
      countedCash: 731_000,
      difference: 233_000,
      autoClosed: false,
      closedBy: { id: RIYA, initials: 'RS' },
    });
    expect(view.history.at(-1)).toMatchObject({
      autoClosed: true,
      closedBy: null,
      difference: 0,
    });
    // The reviewed day is never among its own previous closes.
    const closed = await fetchDayClose(MAIN, '2026-10-01');
    expect(closed.history.map((item) => item.date)).not.toContain('2026-10-01');
  });

  it('counts down a past open day to its midnight, and reads a closed one as its report', async () => {
    const yesterday = await fetchDayClose(MAIN, YESTERDAY);
    expect(yesterday).toMatchObject({ state: 'gate', autoClosesInHours: 14 });
    const closed = await fetchDayClose(MAIN, '2026-10-01');
    expect(closed).toMatchObject({
      state: 'closed',
      opening: { cash: 498_000, source: 'carried', from: '2026-09-30' },
      acceptedBy: { id: RIYA },
      countedCash: 731_000,
      closedBy: { id: RIYA },
      autoClosed: false,
      // Past the grace period: no reopening.
      canReopen: false,
    });
    expect(closed.entries.every((row) => row.locked)).toBe(true);
  });

  it('reads a past day the job had nothing to close as auto-closed on the expected cash', async () => {
    const view = await fetchDayClose(MAIN, '2026-09-20');
    expect(view).toMatchObject({
      state: 'closed',
      entries: [],
      autoClosed: true,
      closedBy: null,
      canReopen: false,
      countedCash: view.expectedCash,
      closedAt: '2026-09-21T18:30:00.000Z',
    });
  });
});

describe('acceptOpeningCash (S:1714)', () => {
  it('stamps the carried count with who and when; the day turns open', async () => {
    const record = await acceptOpeningCash({
      branchId: MAIN,
      date: TODAY,
      recount: null,
    });
    expect(record).toMatchObject({
      branchId: MAIN,
      date: TODAY,
      openingCash: 731_000,
      openingSource: 'carried',
      openingAcceptedAt: NOW.toISOString(),
      openingAcceptedById: RIYA,
      closedAt: null,
    });
    const view = await fetchDayClose(MAIN, TODAY);
    expect(view).toMatchObject({ state: 'open', acceptedBy: { id: RIYA } });
  });

  it('takes a recount that differs as "Recounted", and the suggested source when it matches', async () => {
    const recounted = await acceptOpeningCash({
      branchId: MAIN,
      date: TODAY,
      recount: 700_000,
    });
    expect(recounted).toMatchObject({ openingCash: 700_000, openingSource: 'recounted' });
    const same = await acceptOpeningCash({
      branchId: MAIN,
      date: YESTERDAY,
      recount: 731_000,
    });
    expect(same).toMatchObject({ openingCash: 731_000, openingSource: 'carried' });
  });

  it('accepts on the record a tick already started, once, never on a closed or future day', async () => {
    await setEntryChecked({
      branchId: MAIN,
      date: TODAY,
      paymentId: ref.payment(310),
      checked: true,
    });
    const accepted = await acceptOpeningCash({
      branchId: MAIN,
      date: TODAY,
      recount: null,
    });
    expect(accepted.checkedPaymentIds).toEqual([ref.payment(310)]);
    expect(
      clinicFixtures.dayCloses.snapshot((close) => close.date === TODAY),
    ).toHaveLength(1);
    expect(
      await refusal(acceptOpeningCash({ branchId: MAIN, date: TODAY, recount: null })),
    ).toEqual({
      status: 409,
      message: 'Opening cash already accepted',
    });
    expect(
      await refusal(
        acceptOpeningCash({ branchId: MAIN, date: '2026-10-01', recount: null }),
      ),
    ).toEqual({ status: 409, message: 'Day closed' });
    expect(
      await refusal(
        acceptOpeningCash({ branchId: MAIN, date: '2026-10-04', recount: null }),
      ),
    ).toEqual({ status: 422, message: 'Pick a day up to today' });
    expect(
      await refusal(acceptOpeningCash({ branchId: MAIN, date: YESTERDAY, recount: -5 })),
    ).toEqual({
      status: 422,
      message: 'Count the cash first',
    });
  });
});

describe('closeDay / reopenDay (S:1715, Q-G1)', () => {
  it('closes on the count with who and when, and locks the day’s entries', async () => {
    await acceptOpeningCash({ branchId: MAIN, date: TODAY, recount: null });
    const close = await closeDay({ branchId: MAIN, date: TODAY, countedCash: 700_000 });
    expect(close).toMatchObject({
      countedCash: 700_000,
      closedAt: NOW.toISOString(),
      closedById: RIYA,
    });
    const view = await fetchDayClose(MAIN, TODAY);
    expect(view).toMatchObject({ state: 'closed', autoClosed: false, canReopen: true });
    expect(view.entries.every((row) => row.locked)).toBe(true);
    expect(await isDayClosed(MAIN, TODAY)).toBe(true);
  });

  it('refuses a close before the opening is accepted, twice, or on a bad count', async () => {
    expect(
      await refusal(closeDay({ branchId: MAIN, date: TODAY, countedCash: 1 })),
    ).toEqual({
      status: 409,
      message: 'Accept the opening cash first',
    });
    await acceptOpeningCash({ branchId: MAIN, date: TODAY, recount: null });
    expect(
      await refusal(closeDay({ branchId: MAIN, date: TODAY, countedCash: 1.5 })),
    ).toEqual({
      status: 422,
      message: 'Count the cash first',
    });
    await closeDay({ branchId: MAIN, date: TODAY, countedCash: 705_000 });
    expect(
      await refusal(closeDay({ branchId: MAIN, date: TODAY, countedCash: 705_000 })),
    ).toEqual({
      status: 409,
      message: 'Day closed',
    });
  });

  it('reopens inside the grace period — the count stays, the entries unlock', async () => {
    await acceptOpeningCash({ branchId: MAIN, date: TODAY, recount: null });
    await closeDay({ branchId: MAIN, date: TODAY, countedCash: 700_000 });
    const open = await reopenDay({ branchId: MAIN, date: TODAY });
    expect(open).toMatchObject({
      closedAt: null,
      closedById: null,
      countedCash: 700_000,
    });
    const view = await fetchDayClose(MAIN, TODAY);
    expect(view.state).toBe('open');
    expect(view.entries.some((row) => row.locked)).toBe(false);
  });

  it('refuses to reopen an open day, or one past the grace period', async () => {
    expect(await refusal(reopenDay({ branchId: MAIN, date: TODAY }))).toEqual({
      status: 409,
      message: 'Day is open',
    });
    expect(await refusal(reopenDay({ branchId: MAIN, date: '2026-10-01' }))).toEqual({
      status: 409,
      message: 'Past the grace period',
    });
  });
});

describe('setEntryChecked (C26)', () => {
  it('ticks and unticks an entry of the day on its record', async () => {
    const ticked = await setEntryChecked({
      branchId: MAIN,
      date: TODAY,
      paymentId: ref.payment(310),
      checked: true,
    });
    expect(ticked).toMatchObject({
      checkedPaymentIds: [ref.payment(310)],
      openingAcceptedAt: null,
      openingCash: 731_000,
    });
    expect((await fetchDayClose(MAIN, TODAY)).state).toBe('gate');
    const unticked = await setEntryChecked({
      branchId: MAIN,
      date: TODAY,
      paymentId: ref.payment(310),
      checked: false,
    });
    expect(unticked.checkedPaymentIds).toEqual([]);
  });

  it('refuses an entry of another day', async () => {
    expect(
      await refusal(
        setEntryChecked({
          branchId: MAIN,
          date: TODAY,
          paymentId: ref.payment(306),
          checked: true,
        }),
      ),
    ).toEqual({ status: 422, message: 'Not an entry of this day' });
  });
});

describe('runDayCloseJob — a record left open', () => {
  it('closes a past day whose opening was accepted but never closed, keeping that opening', async () => {
    await acceptOpeningCash({ branchId: MAIN, date: YESTERDAY, recount: 700_000 });
    await runDayCloseJob('2026-10-04');
    const close = clinicFixtures.dayCloses.snapshot((row) => row.date === YESTERDAY)[0];
    expect(close).toMatchObject({
      openingCash: 700_000,
      openingSource: 'recounted',
      closedById: null,
      closedAt: '2026-10-03T18:30:00.000Z',
    });
    // Counted as expected: the recount, less the day's ₹180 of cash out.
    expect(close?.countedCash).toBe(700_000 - 18_000);
  });
});
