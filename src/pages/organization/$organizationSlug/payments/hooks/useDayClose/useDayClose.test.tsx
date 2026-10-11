import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/day-close-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchDayClose: vi.fn(),
  acceptOpeningCash: vi.fn(),
  closeDay: vi.fn(),
  reopenDay: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
import {
  acceptOpeningCash,
  closeDay,
  dayCloseQueryKeys,
  fetchDayClose,
  reopenDay,
} from '@/shared/api/app/day-close-api.ts';
import type {
  DayCloseRecord,
  DayCloseView,
} from '@/shared/api/app/day-close-contracts.ts';
import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  TEST_DAY_CLOSE_ID,
  TEST_MONEY_BRANCH_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  useAcceptOpeningCash,
  useCloseDay,
  useDayClose,
  useReopenDay,
} from './useDayClose.ts';

const TODAY = '2026-10-10';

/** The day's view as the api module reads it — at the gate. */
const VIEW = {
  branchId: TEST_MONEY_BRANCH_ID,
  date: TODAY,
  state: 'gate',
} as DayCloseView;

/** A day's record as a step answers it. */
const RECORD = { id: TEST_DAY_CLOSE_ID, status: 'open' } as DayCloseRecord;

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useDayClose', () => {
  it('waits for the branch, then reads the day under the organization’s key', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(VIEW);
    const idle = renderHook(() => useDayClose(null, TODAY), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');

    const day = renderHook(() => useDayClose(TEST_MONEY_BRANCH_ID, TODAY), { wrapper });
    await waitFor(() => expect(day.result.current.data?.state).toBe('gate'));
    expect(fetchDayClose).toHaveBeenCalledWith(TEST_MONEY_BRANCH_ID, TODAY);
    expect(
      client.getQueryData(dayCloseQueryKeys.day('org_test', TEST_MONEY_BRANCH_ID, TODAY)),
    ).toEqual(VIEW);
  });
});

describe('the steps', () => {
  it('accepts, closes and reopens with the action’s key, refreshing every money read', async () => {
    vi.mocked(acceptOpeningCash).mockResolvedValue(RECORD);
    vi.mocked(closeDay).mockResolvedValue(RECORD);
    vi.mocked(reopenDay).mockResolvedValue(RECORD);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        accept: useAcceptOpeningCash(),
        close: useCloseDay(),
        reopen: useReopenDay(),
      }),
      { wrapper },
    );

    const opening = { branchId: TEST_MONEY_BRANCH_ID, date: TODAY, recount: null };
    await act(() => result.current.accept.mutateAsync(opening));
    expect(acceptOpeningCash).toHaveBeenCalledWith({
      input: opening,
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: paymentQueryKeys.all }),
    );

    const count = {
      closeId: TEST_DAY_CLOSE_ID,
      countedCash: 280,
      differenceReason: 'Short',
    };
    await act(() => result.current.close.mutateAsync(count));
    expect(closeDay).toHaveBeenCalledWith({
      input: count,
      idempotencyKey: expect.any(String),
    });

    const why = { closeId: TEST_DAY_CLOSE_ID, reason: 'Wrong drawer' };
    await act(() => result.current.reopen.mutateAsync(why));
    expect(reopenDay).toHaveBeenCalledWith({
      input: why,
      idempotencyKey: expect.any(String),
    });
  });
});
