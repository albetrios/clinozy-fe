import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

import { useEnsureContactThread } from './useContactThread.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  resetClinicFixtures();
});

describe('useEnsureContactThread', () => {
  it('opens a thread once — a second call, or a double tap, returns the same one', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useEnsureContactThread(), { wrapper });
    const person = { name: 'Meera Joshi', patientId: patientRef('Meera Joshi') };
    let ids: string[] = [];
    await act(async () => {
      const [first, tap] = await Promise.all([
        result.current.mutateAsync(person),
        result.current.mutateAsync(person),
      ]);
      const again = await result.current.mutateAsync(person);
      expect([first.created, again.created]).toEqual([true, false]);
      ids = [first.lead.id, tap.lead.id, again.lead.id];
    });
    expect(new Set(ids).size).toBe(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskQueryKeys.details() });
    // The chat column's threads too: a patient's thread may have just opened.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['clinic', 'messages'] });
  });

  it('toasts a person it cannot identify', async () => {
    const { result } = renderHook(() => useEnsureContactThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Nobody' }).catch(() => undefined);
    });
    expect(notifyMock.error).toHaveBeenCalled();
  });
});
