import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
/** The member's access: resolved, and whether they read the pharmacy queue. */
const access = vi.hoisted(() => ({ isResolved: true, readsPrescriptions: false }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    isResolved: access.isResolved,
    canCode: (code: string) =>
      code === 'patient_prescription:read' && access.readsPrescriptions,
  }),
}));
vi.mock('@/shared/api/clinic/today-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTodayFloor: vi.fn(),
  fetchTodayEnquiries: vi.fn(),
  checkInAppointment: vi.fn(),
  undoCheckIn: vi.fn(),
  moveFloorStage: vi.fn(),
}));

import {
  checkInAppointment,
  fetchTodayEnquiries,
  fetchTodayFloor,
  moveFloorStage,
  todayQueryKeys,
  undoCheckIn,
} from '@/shared/api/clinic/today-api.ts';
import { TODAY_REFETCH_MS } from '@/shared/api/clinic/today-contracts.ts';

import { useTodayEnquiries, useTodayFloor, useTodayMoves } from './useTodayFloor.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  Object.assign(access, { isResolved: true, readsPrescriptions: false });
  vi.mocked(fetchTodayFloor).mockResolvedValue([]);
  vi.mocked(fetchTodayEnquiries).mockResolvedValue([]);
});
afterEach(() => {
  client.clear();
});

describe('useTodayFloor / useTodayEnquiries (KICKOFF §6.2)', () => {
  it('read the floor and the enquiries, polled every 60s', async () => {
    const { result } = renderHook(
      () => ({ floor: useTodayFloor(), enquiries: useTodayEnquiries() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.floor.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.enquiries.isSuccess).toBe(true));
    expect(fetchTodayFloor).toHaveBeenCalledWith({}, { readsPrescriptions: false });
    const polled = client
      .getQueryCache()
      .findAll({ queryKey: todayQueryKeys.floors() })
      .map((query) => (query.options as { refetchInterval?: number }).refetchInterval);
    expect(polled).toEqual([TODAY_REFETCH_MS]);
  });

  it('reads the pharmacy queue for a member who holds patient_prescription:read', async () => {
    access.readsPrescriptions = true;
    const { result } = renderHook(() => useTodayFloor(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchTodayFloor).toHaveBeenCalledWith({}, { readsPrescriptions: true });
  });

  it('waits for the member’s access, so the floor is read once', () => {
    access.isResolved = false;
    const { result } = renderHook(() => useTodayFloor(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchTodayFloor).not.toHaveBeenCalled();
  });

  it('wait while disabled — until the header’s branches are known', () => {
    const { result } = renderHook(() => useTodayFloor({}, { enabled: false }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchTodayFloor).not.toHaveBeenCalled();
  });
});

describe('useTodayMoves', () => {
  it('sends each move with one key per action and refreshes the floor', async () => {
    const { result } = renderHook(useTodayMoves, { wrapper });
    const refresh = vi.spyOn(client, 'invalidateQueries');

    await act(() => result.current.checkIn.mutateAsync('appt_1'));
    await act(() => result.current.undoCheckIn.mutateAsync('appt_1'));
    await act(() =>
      result.current.moveStage.mutateAsync({
        appointmentId: 'appt_1',
        stage: 'with_doctor',
      }),
    );

    const checkInKey = vi.mocked(checkInAppointment).mock.calls[0]?.[0].idempotencyKey;
    expect(checkInAppointment).toHaveBeenCalledWith({
      appointmentId: 'appt_1',
      idempotencyKey: expect.any(String),
    });
    expect(vi.mocked(undoCheckIn).mock.calls[0]?.[0].idempotencyKey).not.toBe(checkInKey);
    expect(moveFloorStage).toHaveBeenCalledWith({
      appointmentId: 'appt_1',
      stage: 'with_doctor',
      idempotencyKey: expect.any(String),
    });
    expect(refresh).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['clinic', 'appointments'] }),
    );
  });
});
