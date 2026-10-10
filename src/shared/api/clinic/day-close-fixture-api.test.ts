import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  assertDayOpen,
  isDayClosed,
  ledgerDayOf,
  runDayCloseJob,
} from './day-close-fixture-api.ts';
import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const MAIN = branchRef(MAIN_BRANCH);

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

  it('closes a past day whose opening was accepted but never closed, keeping that opening', async () => {
    const open = await clinicFixtures.dayCloses.create({
      branchId: MAIN,
      date: '2026-10-02',
      openingCash: 700_000,
      openingSource: 'recounted',
      openingAcceptedAt: '2026-10-02T03:30:00.000Z',
      openingAcceptedById: null,
      countedCash: null,
      closedAt: null,
      closedById: null,
      checkedPaymentIds: [],
    });
    await runDayCloseJob('2026-10-04');
    expect(await clinicFixtures.dayCloses.get(open.id)).toMatchObject({
      openingCash: 700_000,
      openingSource: 'recounted',
      closedById: null,
      closedAt: '2026-10-03T18:30:00.000Z',
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
