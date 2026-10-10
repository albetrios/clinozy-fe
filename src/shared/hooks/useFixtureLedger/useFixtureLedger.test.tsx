import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import { fixtureLedgerQueryKeys } from '@/shared/api/clinic/payments-fixture-api.ts';

import {
  FIXTURE_MONEY_WRITE_KEYS,
  useFixtureDeletePayment,
  useFixtureLedgerList,
  useFixtureOpenSupplierBills,
  useFixtureRestorePayment,
} from './useFixtureLedger.ts';

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

describe('FIXTURE_MONEY_WRITE_KEYS', () => {
  it('refreshes the fixture ledger, never clinozy-be’s', () => {
    expect(FIXTURE_MONEY_WRITE_KEYS).toContainEqual(fixtureLedgerQueryKeys.all);
    expect(FIXTURE_MONEY_WRITE_KEYS).not.toContainEqual(paymentQueryKeys.all);
  });
});

describe('the fixture ledger hooks (Medical)', () => {
  it('reads Medical › Payments as live ledger rows, and the open bills', async () => {
    const { result } = renderHook(
      () => ({
        list: useFixtureLedgerList({ scope: 'medical' }),
        bills: useFixtureOpenSupplierBills(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.rows.length).toBeGreaterThan(0));
    expect(
      result.current.list.rows.every((row) => typeof row.isSettled === 'boolean'),
    ).toBe(true);
    await waitFor(() => expect(result.current.bills.data?.length).toBe(3));
  });

  it('deletes an open-day fixture entry and puts it back', async () => {
    const id = ref.payment(5512);
    const { result } = renderHook(
      () => ({ remove: useFixtureDeletePayment(), restore: useFixtureRestorePayment() }),
      { wrapper },
    );

    await act(() =>
      result.current.remove.mutateAsync({ id, reason: 'duplicate', note: null }),
    );
    expect(clinicFixtures.payments.snapshot((row) => row.id === id)).toEqual([]);

    await act(() => result.current.restore.mutateAsync(id));
    expect(clinicFixtures.payments.snapshot((row) => row.id === id)).toHaveLength(1);
  });
});
