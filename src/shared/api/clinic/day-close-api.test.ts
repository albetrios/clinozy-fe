import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  dayCloseWire,
  paymentWire,
  TEST_DAY_CLOSE_ID,
  TEST_MONEY_AUTHOR_ID,
  TEST_MONEY_BRANCH_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  acceptOpeningCash,
  closeDay,
  fetchDayClose,
  reopenDay,
} from './day-close-api.ts';

/** 10:00 on 10 Oct, clinic time. */
const TODAY = '2026-10-10';

/** A list page as the API answers it. */
const page = (data: unknown[]) => ({
  data,
  meta: { request_id: 'req', pagination: { per_page: 50, next: null, has_more: false } },
});

/** One record as the API answers it. */
const one = (data: unknown) => ({ data, meta: { request_id: 'req' } });

/** The branch's closes the four reads ask for, by what they ask. */
interface Closes {
  day?: unknown[];
  closed?: unknown[];
  open?: unknown[];
  before?: unknown[];
}

/** Answer Day close's reads: the day's record, the closed and open days, the entries. */
function answer(closes: Closes, entries: unknown[] = []) {
  vi.mocked(api.get).mockImplementation(((path: string, init?: { query?: object }) => {
    const query = (init?.query ?? {}) as Record<string, unknown>;
    if (path === '/app/payments') return Promise.resolve(page(entries));
    if (path !== '/app/day-closes') throw new Error(`unexpected GET ${path}`);
    if (query.close_date_from) return Promise.resolve(page(closes.day ?? []));
    if (query.close_date_to) return Promise.resolve(page(closes.before ?? []));
    return Promise.resolve(
      page((query.status === 'open' ? closes.open : closes.closed) ?? []),
    );
  }) as never);
}

/** Every query the day-close list was read with. */
const closeQueries = () =>
  vi
    .mocked(api.get)
    .mock.calls.filter(([path]) => path === '/app/day-closes')
    .map(([, init]) => (init as { query: Record<string, unknown> }).query);

const NISHA = {
  id: TEST_MONEY_AUTHOR_ID,
  userId: 'usr_nisha',
  name: 'Nisha Shah',
  initials: 'NS',
  tone: 'sage' as const,
  roleIds: [],
  branchIds: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  signInTestMember();
  vi.mocked(fetchTeamDirectory).mockResolvedValue([NISHA]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('fetchDayClose', () => {
  it('opens a day nobody opened on the gate, carrying the last close’s count', async () => {
    answer({ closed: [dayCloseWire()] }, [paymentWire()]);

    const view = await fetchDayClose(TEST_MONEY_BRANCH_ID, TODAY);

    expect(closeQueries()).toEqual([
      {
        branch_id: TEST_MONEY_BRANCH_ID,
        close_date_from: TODAY,
        close_date_to: TODAY,
        limit: 1,
      },
      {
        branch_id: TEST_MONEY_BRANCH_ID,
        status: 'closed',
        sort: 'close_date',
        order: 'desc',
        limit: 7,
      },
      {
        branch_id: TEST_MONEY_BRANCH_ID,
        status: 'open',
        sort: 'close_date',
        order: 'asc',
        limit: 20,
      },
    ]);
    expect(view).toMatchObject({
      state: 'gate',
      close: null,
      opening: { cash: 280, source: 'carried', from: '2026-10-09' },
      openingAcceptedAt: null,
      expectedCash: null,
      collectedCount: 1,
      paidOutCount: 0,
      canReopen: false,
      autoClosesInHours: null,
    });
    expect(view.entries.map((row) => row.seq)).toEqual([5]);
    expect(view.history).toEqual([
      {
        closeId: TEST_DAY_CLOSE_ID,
        date: '2026-10-09',
        countedCash: 280,
        difference: -20,
        autoClosed: false,
        closedBy: {
          id: TEST_MONEY_AUTHOR_ID,
          name: 'Nisha Shah',
          initials: 'NS',
          tone: 'sage',
        },
      },
    ]);
  });

  it('reads a closed day’s figures, steps and staff as the server sends them', async () => {
    const closed = dayCloseWire();
    answer({ day: [closed], closed: [closed] });

    const view = await fetchDayClose(TEST_MONEY_BRANCH_ID, '2026-10-09');

    expect(view).toMatchObject({
      state: 'closed',
      cashIn: 300,
      expectedCash: 300,
      countedCash: 280,
      difference: -20,
      differenceReason: 'Short by twenty',
      autoClosed: false,
      canReopen: true,
      netByMode: { cash: 300, upi: 0, card: 0, credit: 0 },
      opening: { cash: 0, source: 'carried', from: null },
      acceptedBy: { name: 'Nisha Shah' },
      closedBy: { name: 'Nisha Shah' },
    });
    expect(view.staff).toEqual([
      {
        membershipId: TEST_MONEY_AUTHOR_ID,
        count: 1,
        amount: 300,
        person: {
          id: TEST_MONEY_AUTHOR_ID,
          name: 'Nisha Shah',
          initials: 'NS',
          tone: 'sage',
        },
      },
    ]);
    expect(view.events.map((event) => [event.kind, event.by?.name])).toEqual([
      ['opened', 'Nisha Shah'],
      ['closed', 'Nisha Shah'],
    ]);
    expect(view.history).toEqual([]);
  });

  it('counts down a past open day to the worker’s close, and lists the branch’s other open days', async () => {
    const open = dayCloseWire({
      id: 'dcl_open00000000000000000',
      close_date: '2026-10-09',
      status: 'open',
      counted_cash: null,
      difference: null,
      difference_reason: null,
      close_kind: null,
      closed_at: null,
      closed_by_membership_id: null,
    });
    answer({
      day: [open],
      open: [dayCloseWire({ close_date: '2026-10-08', status: 'open' }), open],
    });

    const view = await fetchDayClose(TEST_MONEY_BRANCH_ID, '2026-10-09');

    expect(view.state).toBe('open');
    // The worker closes 9 Oct at the end of 10 Oct: 14 hours after 10:00.
    expect(view.autoClosesInHours).toBe(14);
    expect(view.openDays).toEqual([
      { closeId: TEST_DAY_CLOSE_ID, date: '2026-10-08', hoursLeft: 0 },
    ]);
  });

  it('reads the carried close on its own when every listed close is after the day', async () => {
    const later = Array.from({ length: 7 }, (_, index) =>
      dayCloseWire({
        id: `dcl_later${index}000000000000000`,
        close_date: `2026-10-0${index + 2}`,
      }),
    );
    answer({
      closed: later,
      before: [dayCloseWire({ close_date: '2026-09-20', counted_cash: 640 })],
    });

    const view = await fetchDayClose(TEST_MONEY_BRANCH_ID, '2026-09-25');

    expect(view.opening).toEqual({ cash: 640, source: 'carried', from: '2026-09-20' });
    expect(closeQueries().at(-1)).toEqual({
      branch_id: TEST_MONEY_BRANCH_ID,
      status: 'closed',
      close_date_to: '2026-09-24',
      sort: 'close_date',
      order: 'desc',
      limit: 1,
    });
  });
});

describe('the steps', () => {
  it('accepts the carried opening, or a recount', async () => {
    vi.mocked(api.post).mockResolvedValue(one(dayCloseWire()) as never);

    await acceptOpeningCash({
      input: { branchId: TEST_MONEY_BRANCH_ID, date: TODAY, recount: null },
      idempotencyKey: 'key-carried',
    });
    await acceptOpeningCash({
      input: { branchId: TEST_MONEY_BRANCH_ID, date: TODAY, recount: 1500 },
      idempotencyKey: 'key-recount',
    });

    expect(vi.mocked(api.post).mock.calls).toEqual([
      [
        '/app/day-closes',
        {
          body: {
            branch_id: TEST_MONEY_BRANCH_ID,
            close_date: TODAY,
            opening_source: 'carried',
          },
          idempotencyKey: 'key-carried',
        },
      ],
      [
        '/app/day-closes',
        {
          body: {
            branch_id: TEST_MONEY_BRANCH_ID,
            close_date: TODAY,
            opening_source: 'recounted',
            opening_cash: 1500,
          },
          idempotencyKey: 'key-recount',
        },
      ],
    ]);
  });

  it('closes on the count with the difference’s reason, and reopens with why', async () => {
    vi.mocked(api.post).mockResolvedValue(one(dayCloseWire()) as never);

    const closed = await closeDay({
      input: {
        closeId: TEST_DAY_CLOSE_ID,
        countedCash: 280,
        differenceReason: ' Short ',
      },
      idempotencyKey: 'key-close',
    });
    await closeDay({
      input: { closeId: TEST_DAY_CLOSE_ID, countedCash: 300, differenceReason: null },
      idempotencyKey: 'key-matched',
    });
    await reopenDay({
      input: { closeId: TEST_DAY_CLOSE_ID, reason: ' Counted the wrong drawer ' },
      idempotencyKey: 'key-reopen',
    });

    expect(closed).toMatchObject({
      id: TEST_DAY_CLOSE_ID,
      status: 'closed',
      countedCash: 280,
    });
    expect(vi.mocked(api.post).mock.calls).toEqual([
      [
        '/app/day-closes/{day_close_id}/close',
        {
          params: { day_close_id: TEST_DAY_CLOSE_ID },
          body: { counted_cash: 280, difference_reason: 'Short' },
          idempotencyKey: 'key-close',
        },
      ],
      [
        '/app/day-closes/{day_close_id}/close',
        {
          params: { day_close_id: TEST_DAY_CLOSE_ID },
          body: { counted_cash: 300 },
          idempotencyKey: 'key-matched',
        },
      ],
      [
        '/app/day-closes/{day_close_id}/reopen',
        {
          params: { day_close_id: TEST_DAY_CLOSE_ID },
          body: { reason: 'Counted the wrong drawer' },
          idempotencyKey: 'key-reopen',
        },
      ],
    ]);
  });
});
