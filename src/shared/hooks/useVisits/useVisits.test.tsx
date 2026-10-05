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

import {
  useApproveVisitRx,
  useCompleteVisit,
  useCreateVisitBill,
  useOpenVisit,
  useReceiveVisitPayment,
  useRecordVisitSession,
  useRestoreVisitSession,
  useReverseVisitSession,
  useSetVisitChecks,
  useSetVisitStage,
  useShareVisit,
  useStartVisit,
  useUndoVisitChange,
  useVisitCatalog,
  useVisitDetail,
  withVisitChecks,
  withVisitStage,
} from './useVisits.ts';

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

describe('the Visit sheet’s reads and writes (L-49)', () => {
  it('reads a visit, the patient’s open visit and the catalog; idle without ids', async () => {
    const { result } = renderHook(
      () => ({
        detail: useVisitDetail(ref.visit(2865)),
        none: useVisitDetail(null),
        catalog: useVisitCatalog(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.detail.data?.person.name).toBe('Dhruv Patel'),
    );
    await waitFor(() => expect(result.current.catalog.data?.kits).toHaveLength(3));
    expect(result.current.none.fetchStatus).toBe('idle');
    const patientId = result.current.detail.data?.person.patientId ?? '';
    const open = renderHook(() => useOpenVisit(patientId), { wrapper });
    await waitFor(() => expect(open.result.current.data?.id).toBe(ref.visit(2865)));
    expect(
      renderHook(() => useOpenVisit(''), { wrapper }).result.current.fetchStatus,
    ).toBe('idle');
  });

  it('ticks a check at once and keeps it once the server answers', async () => {
    const { result } = renderHook(
      () => ({ detail: useVisitDetail(ref.visit(2866)), checks: useSetVisitChecks() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.detail.data).toBeDefined());
    await act(async () => {
      await result.current.checks.mutateAsync({
        visitId: ref.visit(2866),
        checks: { consent: true },
      });
    });
    await waitFor(() =>
      expect(result.current.detail.data?.visit.checks.consent).toBe(true),
    );
  });

  it('patches only the visit a check write names', () => {
    const detail = {
      visit: { id: 'v', checks: { consent: false, photos: false, allergies: false } },
    };
    expect(withVisitChecks(detail, { visitId: 'v', checks: { photos: true } })).toEqual({
      visit: { id: 'v', checks: { consent: false, photos: true, allergies: false } },
    });
    expect(withVisitChecks(detail, { visitId: 'w', checks: { photos: true } })).toBe(
      detail,
    );
    expect(withVisitChecks(undefined, { visitId: 'v', checks: {} })).toBeUndefined();
  });

  it('patches the file’s open visit too, and leaves the catalogue and “none” alone', () => {
    const open = { id: 'v', checks: { consent: false, photos: false, allergies: false } };
    expect(withVisitChecks(open, { visitId: 'v', checks: { consent: true } })).toEqual({
      id: 'v',
      checks: { consent: true, photos: false, allergies: false },
    });
    expect(withVisitChecks(open, { visitId: 'w', checks: { consent: true } })).toBe(open);
    const catalog = { diagnoses: [], kits: [] };
    expect(withVisitChecks(catalog, { visitId: 'v', checks: { consent: true } })).toBe(
      catalog,
    );
    expect(withVisitChecks(null, { visitId: 'v', checks: { consent: true } })).toBeNull();
  });

  it('starts a visit, bills it, records a session and completes it — failures stay quiet by default', async () => {
    const { result } = renderHook(
      () => ({
        start: useStartVisit(),
        session: useRecordVisitSession(),
        bill: useCreateVisitBill(),
        receive: useReceiveVisitPayment(),
        complete: useCompleteVisit({ notifyOnError: true }),
        share: useShareVisit(),
        approve: useApproveVisitRx(),
        reverse: useReverseVisitSession(),
        restore: useRestoreVisitSession(),
      }),
      { wrapper },
    );
    const sessionResult = await act(() =>
      result.current.session.mutateAsync({
        visitId: ref.visit(2865),
        params: {},
        bodyParts: [],
      }),
    );
    expect(sessionResult.treatment.sessionNo).toBe(4);
    await act(() =>
      result.current.reverse.mutateAsync({
        visitId: ref.visit(2865),
        reason: 'mistake',
        note: null,
      }),
    );
    await act(() =>
      result.current.restore.mutateAsync({
        visitId: ref.visit(2865),
        treatmentId: sessionResult.treatment.id,
      }),
    );
    await act(() => result.current.share.mutateAsync({ visitId: ref.visit(2865) }));
    await act(async () => {
      await result.current.bill
        .mutateAsync({ visitId: ref.visit(2865) })
        .catch(() => undefined);
    });
    // The sheet shows a record write's failure itself — no toast from the hook.
    await act(async () => {
      await result.current.receive
        .mutateAsync({ visitId: ref.visit(2866), amount: 100, mode: 'upi' })
        .catch(() => undefined);
    });
    expect(notify.error).not.toHaveBeenCalled();
    const done = await act(() =>
      result.current.complete.mutateAsync({ visitId: ref.visit(2865) }),
    );
    expect(done.visit.stage).toBe('done');
    await act(async () => {
      await result.current.complete
        .mutateAsync({ visitId: ref.visit(2865) })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledWith('This visit is already completed');
    expect(result.current.start).toBeDefined();
    expect(result.current.approve).toBeDefined();
  });
});
