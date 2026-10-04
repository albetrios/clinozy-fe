import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { todayLaneOf } from '@/shared/api/clinic/today-contracts.ts';
import type * as VisitsApiModule from '@/shared/api/clinic/visits-api.ts';
import { useTodayFloor } from '@/shared/hooks/useTodayFloor/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useSetVisitStage, useUndoVisitChange, withVisitStage } from './useVisits.ts';

/** Holds a stage write until a test lets it land, so the optimistic move can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));
vi.mock('@/shared/api/clinic/visits-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof VisitsApiModule>();
  return {
    ...actual,
    setVisitStage: async (...args: Parameters<typeof actual.setVisitStage>) => {
      await gate.hold;
      return actual.setVisitStage(...args);
    },
  };
});
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
  gate.hold = null;
  vi.mocked(notify.error).mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('withVisitStage (the optimistic move)', () => {
  const row = { id: 'a', seq: 1, status: 'checked_in', visit: null };
  it('moves the one booking’s visit and leaves the rest', () => {
    const other = { ...row, id: 'b' };
    const next = withVisitStage([row, other], 'a', 'with_doctor', 'at') as unknown[];
    expect(next[0]).toEqual({
      ...row,
      visit: { id: '', stage: 'with_doctor', stageAt: 'at' },
    });
    expect(next[1]).toBe(other);
  });

  it('answers the same value when it holds nothing to move', () => {
    const data = [row];
    expect(withVisitStage(data, 'z', 'with_doctor', 'at')).toBe(data);
    const record = { id: 'a' };
    expect(withVisitStage(record, 'a', 'with_doctor', 'at')).toBe(record);
  });
});

describe('useSetVisitStage / useUndoVisitChange (D18)', () => {
  it('moves the card at once, lands the write, and Undo puts it back', async () => {
    let release = () => {};
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });
    const { result } = renderHook(
      () => ({
        floor: useTodayFloor(),
        move: useSetVisitStage(),
        undo: useUndoVisitChange(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.floor.data).toBeDefined());
    const laneOfRhea = () => {
      const rhea = result.current.floor.data?.find((row) => row.seq === 2867);
      return rhea ? todayLaneOf(rhea) : null;
    };
    expect(laneOfRhea()).toBe('waiting');

    let undoToken = '';
    let landed: Promise<void> = Promise.resolve();
    act(() => {
      landed = result.current.move
        .mutateAsync({ appointmentId: ref.appointment(2867), stage: 'with_doctor' })
        .then((change) => {
          undoToken = change.undoToken;
        });
    });
    await waitFor(() => expect(laneOfRhea()).toBe('with_doctor'));
    await act(async () => {
      release();
      await landed;
    });
    await waitFor(() =>
      expect(
        result.current.floor.data?.find((row) => row.seq === 2867)?.visit?.id,
      ).toBeTruthy(),
    );

    await act(async () => {
      await result.current.undo.mutateAsync(undoToken);
    });
    await waitFor(() => expect(laneOfRhea()).toBe('waiting'));
  });

  it('puts the card back and toasts the refusal', async () => {
    const { result } = renderHook(
      () => ({ floor: useTodayFloor(), move: useSetVisitStage() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.floor.data).toBeDefined());
    await act(async () => {
      await result.current.move
        .mutateAsync({ appointmentId: ref.appointment(2848), stage: 'with_doctor' })
        .catch(() => undefined);
    });
    const priti = result.current.floor.data?.find((row) => row.seq === 2848);
    expect(priti ? todayLaneOf(priti) : null).toBe('arriving');
    expect(notify.error).toHaveBeenCalledWith('Check them in first');
  });
});
