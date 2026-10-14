import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  addBranchHoliday,
  addBranchPlace,
  branchPlaceQueryKeys,
  changeBranchPlace,
  fetchBranchHolidays,
  fetchBranchPlaces,
  removeBranchHoliday,
  removeBranchPlace,
  restoreBranchHoliday,
  restoreBranchPlace,
} from './branch-places-api.ts';
import type { BranchHoliday, BranchPlace } from './branch-places-contracts.ts';

const BRANCH = 'brn_vesu00000000000000000';
const KEY = 'key-places-test';

/** A room or machine on the wire. */
const placeRow = (patch: Record<string, unknown> = {}) => ({
  id: 'brm_one000000000000000000',
  branch_id: BRANCH,
  name: 'Room 1',
  is_active: true,
  created_at: '2026-10-01T05:00:00.000Z',
  updated_at: '2026-10-02T05:00:00.000Z',
  ...patch,
});

/** A holiday on the wire. */
const holidayRow = (patch: Record<string, unknown> = {}) => ({
  id: 'bhd_diwali00000000000000',
  branch_id: BRANCH,
  holiday_date: '2026-11-08',
  label: 'Diwali',
  created_at: '2026-10-01T05:00:00.000Z',
  updated_at: '2026-10-01T05:00:00.000Z',
  ...patch,
});

const ROOM: BranchPlace = {
  id: 'brm_one000000000000000000',
  branchId: BRANCH,
  name: 'Room 1',
  active: true,
  createdAt: '2026-10-01T05:00:00.000Z',
  updatedAt: '2026-10-02T05:00:00.000Z',
};

const DIWALI: BranchHoliday = {
  id: 'bhd_diwali00000000000000',
  branchId: BRANCH,
  date: '2026-11-08',
  label: 'Diwali',
  createdAt: '2026-10-01T05:00:00.000Z',
  updatedAt: '2026-10-01T05:00:00.000Z',
};

beforeEach(() => {
  for (const fn of Object.values(api)) vi.mocked(fn).mockReset();
  vi.mocked(api.post).mockResolvedValue({ data: placeRow() } as never);
  vi.mocked(api.patch).mockResolvedValue({ data: placeRow() } as never);
  vi.mocked(api.delete).mockResolvedValue({ data: undefined } as never);
});

describe('branchPlaceQueryKeys', () => {
  it('sits under the branches key, so a branch write refreshes the places too', () => {
    expect(branchPlaceQueryKeys.list('org_a', BRANCH, 'room')).toEqual([
      'app',
      'branches',
      'places',
      'org_a',
      BRANCH,
      'room',
    ]);
  });
});

describe('fetchBranchPlaces', () => {
  it('reads every page of the rooms, oldest first, switched-off ones too', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: [placeRow()],
        meta: { pagination: { next: 'cursor-two' } },
      } as never)
      .mockResolvedValueOnce({
        data: [placeRow({ id: 'brm_two', name: 'Room 2', is_active: false })],
        meta: { pagination: { next: null } },
      } as never);
    const rooms = await fetchBranchPlaces({ kind: 'room', branchId: BRANCH });
    expect(rooms).toEqual([
      ROOM,
      { ...ROOM, id: 'brm_two', name: 'Room 2', active: false },
    ]);
    expect(api.get).toHaveBeenNthCalledWith(1, '/app/branches/{branch_id}/rooms', {
      params: { branch_id: BRANCH },
      query: { limit: 100, after: undefined, sort: 'created_at', order: 'asc' },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/branches/{branch_id}/rooms', {
      params: { branch_id: BRANCH },
      query: { limit: 100, after: 'cursor-two', sort: 'created_at', order: 'asc' },
    });
  });

  it('reads the machines from their own route', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never);
    await expect(
      fetchBranchPlaces({ kind: 'machine', branchId: BRANCH }),
    ).resolves.toEqual([]);
    expect(api.get).toHaveBeenCalledWith(
      '/app/branches/{branch_id}/machines',
      expect.objectContaining({ params: { branch_id: BRANCH } }),
    );
  });

  it('refuses a row missing a field the drawer needs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'brm_x' }] } as never);
    await expect(fetchBranchPlaces({ kind: 'room', branchId: BRANCH })).rejects.toThrow();
  });
});

describe('room and machine writes', () => {
  it('adds one switched on, with the action’s key', async () => {
    await addBranchPlace({
      kind: 'room',
      branchId: BRANCH,
      name: 'Room 1',
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/branches/{branch_id}/rooms', {
      params: { branch_id: BRANCH },
      body: { name: 'Room 1', is_active: true },
      idempotencyKey: KEY,
    });
  });

  it('renames with the read’s updated_at', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: placeRow({ name: 'Laser room' }),
    } as never);
    const saved = await changeBranchPlace({
      kind: 'room',
      place: ROOM,
      change: { name: 'Laser room' },
      idempotencyKey: KEY,
    });
    expect(saved.name).toBe('Laser room');
    expect(api.patch).toHaveBeenCalledWith(
      '/app/branches/{branch_id}/rooms/{branch_room_id}',
      {
        params: { branch_id: BRANCH, branch_room_id: ROOM.id },
        body: { name: 'Laser room', expected_updated_at: ROOM.updatedAt },
        idempotencyKey: KEY,
      },
    );
  });

  it('switches a machine off with is_active alone', async () => {
    await changeBranchPlace({
      kind: 'machine',
      place: ROOM,
      change: { active: false },
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/branches/{branch_id}/machines/{branch_machine_id}',
      {
        params: { branch_id: BRANCH, branch_machine_id: ROOM.id },
        body: { is_active: false, expected_updated_at: ROOM.updatedAt },
        idempotencyKey: undefined,
      },
    );
  });

  it('removes with the confirm’s reason and note, and restores', async () => {
    await removeBranchPlace({
      kind: 'room',
      place: ROOM,
      reason: 'other',
      note: 'Merged',
    });
    expect(api.delete).toHaveBeenCalledWith(
      '/app/branches/{branch_id}/rooms/{branch_room_id}',
      {
        params: { branch_id: BRANCH, branch_room_id: ROOM.id },
        reason: 'other',
        note: 'Merged',
      },
    );
    await removeBranchPlace({
      kind: 'machine',
      place: ROOM,
      reason: 'mistake',
      note: null,
    });
    expect(api.delete).toHaveBeenLastCalledWith(
      '/app/branches/{branch_id}/machines/{branch_machine_id}',
      {
        params: { branch_id: BRANCH, branch_machine_id: ROOM.id },
        reason: 'mistake',
        note: undefined,
      },
    );
    await restoreBranchPlace({ kind: 'machine', place: ROOM, idempotencyKey: KEY });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/branches/{branch_id}/machines/{branch_machine_id}/restore',
      { params: { branch_id: BRANCH, branch_machine_id: ROOM.id }, idempotencyKey: KEY },
    );
  });
});

describe('holidays', () => {
  it('reads every holiday from the given day on, earliest first', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [holidayRow()] } as never);
    await expect(
      fetchBranchHolidays({ branchId: BRANCH, from: '2026-10-13' }),
    ).resolves.toEqual([DIWALI]);
    expect(api.get).toHaveBeenCalledWith('/app/branches/{branch_id}/holidays', {
      params: { branch_id: BRANCH },
      query: {
        limit: 100,
        after: undefined,
        holiday_date_from: '2026-10-13',
        sort: 'holiday_date',
        order: 'asc',
      },
    });
  });

  it('adds, removes and restores one', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: holidayRow() } as never);
    await expect(
      addBranchHoliday({
        branchId: BRANCH,
        date: '2026-11-08',
        label: 'Diwali',
        idempotencyKey: KEY,
      }),
    ).resolves.toEqual(DIWALI);
    expect(api.post).toHaveBeenCalledWith('/app/branches/{branch_id}/holidays', {
      params: { branch_id: BRANCH },
      body: { holiday_date: '2026-11-08', label: 'Diwali' },
      idempotencyKey: KEY,
    });
    await removeBranchHoliday({ holiday: DIWALI, reason: 'not_needed', note: null });
    expect(api.delete).toHaveBeenCalledWith(
      '/app/branches/{branch_id}/holidays/{branch_holiday_id}',
      {
        params: { branch_id: BRANCH, branch_holiday_id: DIWALI.id },
        reason: 'not_needed',
        note: undefined,
      },
    );
    await restoreBranchHoliday({ holiday: DIWALI, idempotencyKey: KEY });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/branches/{branch_id}/holidays/{branch_holiday_id}/restore',
      {
        params: { branch_id: BRANCH, branch_holiday_id: DIWALI.id },
        idempotencyKey: KEY,
      },
    );
  });
});
