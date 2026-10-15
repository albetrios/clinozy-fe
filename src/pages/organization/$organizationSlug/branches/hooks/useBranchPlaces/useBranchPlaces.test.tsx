import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BranchPlacesApiModule from '@/shared/api/app/branch-places-api.ts';
import {
  addBranchHoliday,
  addBranchPlace,
  branchPlaceQueryKeys,
  changeBranchPlace,
  fetchBranchHolidays,
  fetchBranchPlaces,
  removeBranchPlace,
  restoreBranchPlace,
} from '@/shared/api/app/branch-places-api.ts';
import type { BranchPlace } from '@/shared/api/app/branch-places-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  useBranchHolidayWrites,
  useBranchPlaces,
  useBranchPlaceWrites,
} from './useBranchPlaces.ts';

vi.mock('@/shared/api/app/branch-places-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof BranchPlacesApiModule>()),
  fetchBranchPlaces: vi.fn(),
  fetchBranchHolidays: vi.fn(),
  addBranchPlace: vi.fn(),
  changeBranchPlace: vi.fn(),
  removeBranchPlace: vi.fn(),
  restoreBranchPlace: vi.fn(),
  addBranchHoliday: vi.fn(),
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const BRANCH = 'brn_vesu00000000000000000';
const ROOM: BranchPlace = {
  id: 'brm_one000000000000000000',
  branchId: BRANCH,
  name: 'Room 1',
  active: true,
  createdAt: '2026-10-01T05:00:00.000Z',
  updatedAt: '2026-10-01T05:00:00.000Z',
};

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(fetchBranchPlaces).mockResolvedValue([ROOM]);
  vi.mocked(fetchBranchHolidays).mockResolvedValue([]);
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
  vi.resetAllMocks();
});

describe('useBranchPlaces', () => {
  it('reads nothing for a new branch', () => {
    const { result } = renderHook(() => useBranchPlaces(null), { wrapper });
    expect(result.current.ready).toBe(false);
    expect(fetchBranchPlaces).not.toHaveBeenCalled();
    expect(fetchBranchHolidays).not.toHaveBeenCalled();
  });

  it('reads the rooms, the machines and the holidays from today on', async () => {
    const { result } = renderHook(() => useBranchPlaces(BRANCH), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.rooms).toEqual([ROOM]);
    expect(fetchBranchPlaces).toHaveBeenCalledWith({ kind: 'machine', branchId: BRANCH });
    expect(fetchBranchHolidays).toHaveBeenCalledWith({
      branchId: BRANCH,
      from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('reports a failed list with nothing to show, and retries only what failed', async () => {
    vi.mocked(fetchBranchHolidays).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useBranchPlaces(BRANCH), { wrapper });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.ready).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(fetchBranchHolidays).toHaveBeenCalledTimes(2);
    expect(fetchBranchPlaces).toHaveBeenCalledTimes(2);
  });
});

describe('useBranchPlaceWrites', () => {
  it('adds with its own key, says so and refreshes that list', async () => {
    vi.mocked(addBranchPlace).mockResolvedValue({ ...ROOM, name: 'Room 3' });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => useBranchPlaceWrites({ kind: 'room', branchId: BRANCH }),
      { wrapper },
    );
    await act(() => result.current.add.mutateAsync({ name: 'Room 3' }));
    expect(addBranchPlace).toHaveBeenCalledWith({
      kind: 'room',
      branchId: BRANCH,
      name: 'Room 3',
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Room 3 added', {
      id: 'branch-places-room',
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: branchPlaceQueryKeys.list('org_test', BRANCH, 'room'),
    });
  });

  it('switches a room off in place at once, and puts it back when refused — quietly', async () => {
    const key = branchPlaceQueryKeys.list('org_test', BRANCH, 'room');
    queryClient.setQueryData(key, [ROOM]);
    // The write's own answer, held until the test refuses it.
    const answer: { refuse?: (error: unknown) => void } = {};
    vi.mocked(changeBranchPlace).mockReturnValue(
      new Promise((_, reject) => {
        answer.refuse = reject;
      }),
    );
    const { result } = renderHook(
      () => useBranchPlaceWrites({ kind: 'room', branchId: BRANCH }),
      { wrapper },
    );
    let write: Promise<unknown> = Promise.resolve();
    act(() => {
      write = result.current.change
        .mutateAsync({ place: ROOM, change: { active: false } })
        .catch(() => undefined);
    });
    await waitFor(() =>
      expect(queryClient.getQueryData<BranchPlace[]>(key)?.[0]?.active).toBe(false),
    );
    answer.refuse?.(new HttpError('Conflict', 409, '/app/branches', 'PATCH', {}));
    await act(() => write);
    expect(queryClient.getQueryData<BranchPlace[]>(key)?.[0]?.active).toBe(true);
    // The row says why, not the hook.
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('keeps the saved updated_at for the next change, and names what it did', async () => {
    const key = branchPlaceQueryKeys.list('org_test', BRANCH, 'room');
    queryClient.setQueryData(key, [ROOM]);
    const saved = { ...ROOM, active: false, updatedAt: '2026-10-13T06:00:00.000Z' };
    vi.mocked(changeBranchPlace).mockResolvedValue(saved);
    const { result } = renderHook(
      () => useBranchPlaceWrites({ kind: 'room', branchId: BRANCH }),
      { wrapper },
    );
    await act(() =>
      result.current.change.mutateAsync({ place: ROOM, change: { active: false } }),
    );
    expect(queryClient.getQueryData<BranchPlace[]>(key)?.[0]?.updatedAt).toBe(
      saved.updatedAt,
    );
    expect(notifyMock.success).toHaveBeenCalledWith('Room 1 switched off', {
      id: 'branch-places-room',
    });
  });

  it('removes with the reason, and restores', async () => {
    vi.mocked(removeBranchPlace).mockResolvedValue();
    vi.mocked(restoreBranchPlace).mockResolvedValue(ROOM);
    const { result } = renderHook(
      () => useBranchPlaceWrites({ kind: 'machine', branchId: BRANCH }),
      { wrapper },
    );
    await act(() =>
      result.current.remove.mutateAsync({
        record: ROOM,
        reason: 'duplicate',
        note: null,
      }),
    );
    expect(removeBranchPlace).toHaveBeenCalledWith({
      kind: 'machine',
      place: ROOM,
      reason: 'duplicate',
      note: null,
    });
    await act(() => result.current.restore.mutateAsync(ROOM));
    expect(restoreBranchPlace).toHaveBeenCalledWith({
      kind: 'machine',
      place: ROOM,
      idempotencyKey: expect.any(String),
    });
  });
});

describe('useBranchHolidayWrites', () => {
  it('adds a holiday with its own key and says so by its label', async () => {
    vi.mocked(addBranchHoliday).mockResolvedValue({
      id: 'bhd_diwali00000000000000',
      branchId: BRANCH,
      date: '2026-11-08',
      label: 'Diwali',
      createdAt: '2026-10-13T05:00:00.000Z',
      updatedAt: '2026-10-13T05:00:00.000Z',
    });
    const { result } = renderHook(() => useBranchHolidayWrites({ branchId: BRANCH }), {
      wrapper,
    });
    await act(() =>
      result.current.add.mutateAsync({ date: '2026-11-08', label: 'Diwali' }),
    );
    expect(addBranchHoliday).toHaveBeenCalledWith({
      branchId: BRANCH,
      date: '2026-11-08',
      label: 'Diwali',
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Diwali added', {
      id: 'branch-places-holiday',
    });
  });
});
