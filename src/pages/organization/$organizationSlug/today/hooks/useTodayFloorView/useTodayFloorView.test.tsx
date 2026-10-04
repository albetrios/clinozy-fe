import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as TodayApiModule from '@/shared/api/clinic/today-api.ts';
import { notify } from '@/shared/notify/index.ts';

import { useTodayFloorView } from './useTodayFloorView.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const gate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/today-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TodayApiModule>();
  return {
    ...actual,
    fetchTodayFloor: async (...args: Parameters<typeof actual.fetchTodayFloor>) => {
      if (gate.failing) throw new Error('connection dropped');
      return actual.fetchTodayFloor(...args);
    },
  };
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  gate.failing = false;
  vi.mocked(notify.error).mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('useTodayFloorView (KICKOFF §6.2 Route and data, States)', () => {
  it('reads the floor into lanes and the pulse, loading until both reads land', async () => {
    const { result } = renderHook(() => useTodayFloorView(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pulse).toEqual({ inClinic: 7, waiting: 3, arriving: 2 });
    expect(result.current.lanes.enquiries.map((card) => card.name)).toEqual([
      'Kabir Mehta',
      'Anaya Desai',
    ]);
  });

  it('toasts a failed read once, with Retry', async () => {
    gate.failing = true;
    const { result } = renderHook(() => useTodayFloorView(), { wrapper });
    await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
    expect(notify.error).toHaveBeenCalledWith(
      'Couldn’t load this list · connection dropped. Showing the last copy.',
      expect.objectContaining({ id: 'list-error:today-floor' }),
    );
    expect(result.current.lanes.waiting).toEqual([]);
  });
});
