import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dayCloseQueryKeys } from '@/shared/api/clinic/day-close-api.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import {
  branchRef,
  MAIN_BRANCH,
} from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useAcceptOpeningCash,
  useCloseDay,
  useDayClose,
  useEntryCheck,
  useReopenDay,
} from './useDayClose.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const MAIN = branchRef(MAIN_BRANCH);
const TODAY = '2026-10-03';
const KEY = { branchId: MAIN, date: TODAY };

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  vi.useRealTimers();
  client.clear();
  resetClinicFixtures();
});

describe('useDayClose', () => {
  it('waits for the branch, then reads the day under its key', async () => {
    const idle = renderHook(() => useDayClose(null, TODAY), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    const day = renderHook(() => useDayClose(MAIN, TODAY), { wrapper });
    await waitFor(() => expect(day.result.current.data?.state).toBe('gate'));
    expect(client.getQueryData(dayCloseQueryKeys.day(MAIN, TODAY))).toBeTruthy();
  });
});

describe('the Day close writes', () => {
  it('accept → close → reopen, the day following each', async () => {
    const day = renderHook(() => useDayClose(MAIN, TODAY), { wrapper });
    await waitFor(() => expect(day.result.current.data?.state).toBe('gate'));
    const accept = renderHook(() => useAcceptOpeningCash(), { wrapper });
    await act(() => accept.result.current.mutateAsync({ ...KEY, recount: null }));
    await waitFor(() => expect(day.result.current.data?.state).toBe('open'));
    const close = renderHook(() => useCloseDay(), { wrapper });
    await act(() => close.result.current.mutateAsync({ ...KEY, countedCash: 705_000 }));
    await waitFor(() => expect(day.result.current.data?.state).toBe('closed'));
    const reopen = renderHook(() => useReopenDay(), { wrapper });
    await act(() => reopen.result.current.mutateAsync(KEY));
    await waitFor(() => expect(day.result.current.data?.state).toBe('open'));
  });

  it('ticks optimistically, and unticks', async () => {
    const day = renderHook(() => useDayClose(MAIN, TODAY), { wrapper });
    await waitFor(() => expect(day.result.current.data?.checkedIds).toEqual([]));
    const check = renderHook(() => useEntryCheck(KEY), { wrapper });
    const entry = ref.payment(310);
    act(() => check.result.current.mutate({ ...KEY, paymentId: entry, checked: true }));
    // The cache moves with the tick; the write's refetch agrees.
    await waitFor(() =>
      expect(
        client.getQueryData<DayCloseView>(dayCloseQueryKeys.day(MAIN, TODAY))?.checkedIds,
      ).toEqual([entry]),
    );
    await waitFor(() => expect(check.result.current.isSuccess).toBe(true));
    await act(() =>
      check.result.current.mutateAsync({ ...KEY, paymentId: entry, checked: false }),
    );
    await waitFor(() => expect(day.result.current.data?.checkedIds).toEqual([]));
  });
});
