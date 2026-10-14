import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import type { DeleteReason } from './app-schema.ts';
import type {
  BranchHoliday,
  BranchPlace,
  BranchPlaceChange,
  BranchPlaceKind,
} from './branch-places-contracts.ts';
import { branchQueryKeys } from './branches-api.ts';

/*
 * The branch drawer's "Places & days" (KICKOFF §6.6, D23) on clinozy-be: a branch's rooms and
 * machines (`…/rooms`, `…/machines` — list, add, rename or switch off, remove, restore) and its
 * holidays (`…/holidays` — list, add, remove, restore). Each row is its own write; there is no
 * batch. Kept apart from `branches-manage-api.ts`, which saves the branch itself.
 */

/** What a places read is: the rooms, the machines or the holidays. */
export type BranchPlacesList = BranchPlaceKind | 'holiday';

/** TanStack Query keys for a branch's places — under `branchQueryKeys.all`, so a branch write refreshes them too. */
export const branchPlaceQueryKeys = {
  all: [...branchQueryKeys.all, 'places'] as const,
  /** One list of one branch in one organization. */
  list: (organizationId: string | null, branchId: string, list: BranchPlacesList) =>
    [...branchPlaceQueryKeys.all, organizationId, branchId, list] as const,
};

type ApiRoom = NonNullable<
  ApiData<'/app/branches/{branch_id}/rooms/{branch_room_id}', 'get'>
>;
type ApiMachine = NonNullable<
  ApiData<'/app/branches/{branch_id}/machines/{branch_machine_id}', 'get'>
>;
type ApiHoliday = NonNullable<
  ApiData<'/app/branches/{branch_id}/holidays/{branch_holiday_id}', 'get'>
>;

/** A room and a machine are one shape on the wire. */
const placeShape = {
  id: z.string(),
  branch_id: z.string(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
};

const roomWire = wireSchema<ApiRoom>()(z.object(placeShape));
const machineWire = wireSchema<ApiMachine>()(z.object(placeShape));

const holidayWire = wireSchema<ApiHoliday>()(
  z.object({
    id: z.string(),
    branch_id: z.string(),
    holiday_date: z.string(),
    label: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** A wire room or machine as the drawer reads it. */
function toBranchPlace(row: z.output<typeof roomWire>): BranchPlace {
  return {
    id: row.id,
    branchId: row.branch_id,
    name: row.name,
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A wire holiday as the drawer reads it. */
function toBranchHoliday(row: z.output<typeof holidayWire>): BranchHoliday {
  return {
    id: row.id,
    branchId: row.branch_id,
    date: row.holiday_date,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The wire schema of a kind's rows. */
const placeWireOf = (kind: BranchPlaceKind) => (kind === 'room' ? roomWire : machineWire);

/** Every page of a list: 100 a page, as the API allows. */
const PAGE_SIZE = 100;

/**
 * A branch's rooms or machines, switched-off ones included, in the order they were added
 * (`GET …/rooms` / `…/machines`, every member).
 */
export async function fetchBranchPlaces({
  kind,
  branchId,
}: {
  kind: BranchPlaceKind;
  branchId: string;
}): Promise<BranchPlace[]> {
  const wire = placeWireOf(kind);
  const rows = await collectAllPages(async (after) => {
    const init = {
      params: { branch_id: branchId },
      query: {
        limit: PAGE_SIZE,
        after: after ?? undefined,
        sort: 'created_at' as const,
        order: 'asc' as const,
      },
    };
    const response =
      kind === 'room'
        ? await api.get('/app/branches/{branch_id}/rooms', init)
        : await api.get('/app/branches/{branch_id}/machines', init);
    return {
      rows: z.array(wire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, `branch-${kind}s`);
  return rows.map(toBranchPlace);
}

/** Add a room or machine, switched on (`POST …/rooms` / `…/machines`, `branch:create`). */
export async function addBranchPlace({
  kind,
  branchId,
  name,
  idempotencyKey,
}: {
  kind: BranchPlaceKind;
  branchId: string;
  name: string;
  idempotencyKey: string;
}): Promise<BranchPlace> {
  const init = {
    params: { branch_id: branchId },
    body: { name, is_active: true },
    idempotencyKey,
  };
  const response =
    kind === 'room'
      ? await api.post('/app/branches/{branch_id}/rooms', init)
      : await api.post('/app/branches/{branch_id}/machines', init);
  return toBranchPlace(placeWireOf(kind).parse(response.data));
}

/**
 * Rename a room or machine, or switch it on or off (`PATCH …/rooms/{branch_room_id}` /
 * `…/machines/{branch_machine_id}`, `branch:update`) — with the read's `updated_at`, so a change
 * over someone else's is a `409 record_changed`; a name the branch already has is a reasonless 409.
 */
export async function changeBranchPlace({
  kind,
  place,
  change,
  idempotencyKey,
}: {
  kind: BranchPlaceKind;
  place: BranchPlace;
  change: BranchPlaceChange;
  idempotencyKey?: string;
}): Promise<BranchPlace> {
  const body = {
    ...('name' in change ? { name: change.name } : { is_active: change.active }),
    expected_updated_at: place.updatedAt,
  };
  const response =
    kind === 'room'
      ? await api.patch('/app/branches/{branch_id}/rooms/{branch_room_id}', {
          params: { branch_id: place.branchId, branch_room_id: place.id },
          body,
          idempotencyKey,
        })
      : await api.patch('/app/branches/{branch_id}/machines/{branch_machine_id}', {
          params: { branch_id: place.branchId, branch_machine_id: place.id },
          body,
          idempotencyKey,
        });
  return toBranchPlace(placeWireOf(kind).parse(response.data));
}

/** Remove a room or machine with the confirm's reason (`DELETE …?reason=&note=`, `branch:delete`). */
export async function removeBranchPlace({
  kind,
  place,
  reason,
  note,
}: {
  kind: BranchPlaceKind;
  place: BranchPlace;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  if (kind === 'room') {
    await api.delete('/app/branches/{branch_id}/rooms/{branch_room_id}', {
      params: { branch_id: place.branchId, branch_room_id: place.id },
      reason,
      note: note ?? undefined,
    });
    return;
  }
  await api.delete('/app/branches/{branch_id}/machines/{branch_machine_id}', {
    params: { branch_id: place.branchId, branch_machine_id: place.id },
    reason,
    note: note ?? undefined,
  });
}

/** Undo a room's or machine's removal — the removal toast's Undo (`POST …/restore`, `branch:delete`). */
export async function restoreBranchPlace({
  kind,
  place,
  idempotencyKey,
}: {
  kind: BranchPlaceKind;
  place: BranchPlace;
  idempotencyKey: string;
}): Promise<BranchPlace> {
  const response =
    kind === 'room'
      ? await api.post('/app/branches/{branch_id}/rooms/{branch_room_id}/restore', {
          params: { branch_id: place.branchId, branch_room_id: place.id },
          idempotencyKey,
        })
      : await api.post('/app/branches/{branch_id}/machines/{branch_machine_id}/restore', {
          params: { branch_id: place.branchId, branch_machine_id: place.id },
          idempotencyKey,
        });
  return toBranchPlace(placeWireOf(kind).parse(response.data));
}

/**
 * A branch's holidays from `from` on (the clinic's today), earliest first (`GET …/holidays`,
 * every member) — a past one no longer closes anything.
 */
export async function fetchBranchHolidays({
  branchId,
  from,
}: {
  branchId: string;
  from: string;
}): Promise<BranchHoliday[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/branches/{branch_id}/holidays', {
      params: { branch_id: branchId },
      query: {
        limit: PAGE_SIZE,
        after: after ?? undefined,
        holiday_date_from: from,
        sort: 'holiday_date',
        order: 'asc',
      },
    });
    return {
      rows: z.array(holidayWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'branch-holidays');
  return rows.map(toBranchHoliday);
}

/**
 * Add a holiday (`POST …/holidays`, `branch:create`); a second one on the same day is a
 * reasonless 409.
 */
export async function addBranchHoliday({
  branchId,
  date,
  label,
  idempotencyKey,
}: {
  branchId: string;
  date: string;
  label: string;
  idempotencyKey: string;
}): Promise<BranchHoliday> {
  const response = await api.post('/app/branches/{branch_id}/holidays', {
    params: { branch_id: branchId },
    body: { holiday_date: date, label },
    idempotencyKey,
  });
  return toBranchHoliday(holidayWire.parse(response.data));
}

/** Remove a holiday with the confirm's reason (`DELETE …?reason=&note=`, `branch:delete`). */
export async function removeBranchHoliday({
  holiday,
  reason,
  note,
}: {
  holiday: BranchHoliday;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/branches/{branch_id}/holidays/{branch_holiday_id}', {
    params: { branch_id: holiday.branchId, branch_holiday_id: holiday.id },
    reason,
    note: note ?? undefined,
  });
}

/** Undo a holiday's removal — the removal toast's Undo (`POST …/restore`, `branch:delete`). */
export async function restoreBranchHoliday({
  holiday,
  idempotencyKey,
}: {
  holiday: BranchHoliday;
  idempotencyKey: string;
}): Promise<BranchHoliday> {
  const response = await api.post(
    '/app/branches/{branch_id}/holidays/{branch_holiday_id}/restore',
    {
      params: { branch_id: holiday.branchId, branch_holiday_id: holiday.id },
      idempotencyKey,
    },
  );
  return toBranchHoliday(holidayWire.parse(response.data));
}
