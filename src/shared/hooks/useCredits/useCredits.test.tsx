import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { creditQueryKeys } from '@/shared/api/clinic/credits-api.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useCreateCredit,
  useCredit,
  useCreditList,
  useDeleteCredit,
  useRestoreCredit,
  useSettleCredit,
  useUpdateCredit,
} from './useCredits.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

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

describe('useCreditList / useCredit', () => {
  it('pages the credits under the domain key, and reads one', async () => {
    const list = renderHook(() => useCreditList({}), { wrapper });
    await waitFor(() => expect(list.result.current.rows).toHaveLength(2));
    expect(
      client.getQueryCache().findAll({ queryKey: creditQueryKeys.lists() })[0],
    ).toBeTruthy();
    const one = renderHook(() => useCredit(ref.pendingCredit(2)), { wrapper });
    await waitFor(() => expect(one.result.current.data?.partyName).toBe('Tanvi Shah'));
  });
});

describe('the credit writes', () => {
  it('adds, edits, settles, deletes and restores — the list following each', async () => {
    const list = renderHook(() => useCreditList({}), { wrapper });
    await waitFor(() => expect(list.result.current.rows).toHaveLength(2));
    const create = renderHook(() => useCreateCredit(), { wrapper });
    const created = await act(() =>
      create.result.current.mutateAsync({
        direction: 'give',
        partyName: 'Rhea Shah',
        patientId: patientRef('Rhea Shah'),
        amount: 20_000,
        reasonKey: 'overpaid',
        invoiceId: null,
        settleBy: null,
        note: null,
      }),
    );
    await waitFor(() => expect(list.result.current.rows).toHaveLength(3));

    const update = renderHook(() => useUpdateCredit(), { wrapper });
    await act(() =>
      update.result.current.mutateAsync({
        id: created.id,
        input: {
          direction: 'give',
          partyName: 'Rhea Shah',
          patientId: patientRef('Rhea Shah'),
          amount: 30_000,
          reasonKey: 'overpaid',
          invoiceId: null,
          settleBy: null,
          note: null,
        },
      }),
    );
    await waitFor(() =>
      expect(list.result.current.rows.find((row) => row.id === created.id)?.amount).toBe(
        30_000,
      ),
    );

    const settle = renderHook(() => useSettleCredit(), { wrapper });
    const result = await act(() =>
      settle.result.current.mutateAsync({
        id: created.id,
        settlement: { action: 'give_back', splits: [{ mode: 'cash', amount: 30_000 }] },
      }),
    );
    expect(result.credit.status).toBe('given_back');

    const remove = renderHook(() => useDeleteCredit(), { wrapper });
    await act(() =>
      remove.result.current.mutateAsync({
        id: ref.pendingCredit(1),
        reason: 'mistake',
        note: null,
      }),
    );
    await waitFor(() => expect(list.result.current.rows).toHaveLength(2));
    const restore = renderHook(() => useRestoreCredit(), { wrapper });
    await act(() => restore.result.current.mutateAsync(ref.pendingCredit(1)));
    await waitFor(() => expect(list.result.current.rows).toHaveLength(3));
  });
});
