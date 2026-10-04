import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { todayQueryKeys } from '@/shared/api/clinic/today-api.ts';
import { TODAY_REFETCH_MS } from '@/shared/api/clinic/today-contracts.ts';

import { useTodayEnquiries, useTodayFloor } from './useTodayFloor.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('useTodayFloor / useTodayEnquiries (KICKOFF §6.2)', () => {
  it('read the floor and the enquiries, polled every 60s', async () => {
    const { result } = renderHook(
      () => ({ floor: useTodayFloor(), enquiries: useTodayEnquiries() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.floor.data).toHaveLength(9));
    await waitFor(() => expect(result.current.enquiries.data).toHaveLength(2));
    const polled = client
      .getQueryCache()
      .findAll({ queryKey: todayQueryKeys.floors() })
      .map((query) => (query.options as { refetchInterval?: number }).refetchInterval);
    expect(polled).toEqual([TODAY_REFETCH_MS]);
  });

  it('wait while disabled — until the header’s branches are known', () => {
    const { result } = renderHook(() => useTodayFloor({}, { enabled: false }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isPending).toBe(true);
  });
});
