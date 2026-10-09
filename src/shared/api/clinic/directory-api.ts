import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/*
 * The names a room's rows point at by id — a booking's doctor (`doctor_membership_id`), its room
 * (`branch_room_id`) — resolved in one read per set, never one per row, and kept for a few
 * minutes so a polled list (Today's floor) does not read them again on every poll.
 */

/** How long a resolved name is reused before it is read again. */
const DIRECTORY_STALE_MS = 5 * 60_000;

/** The member picker takes at most this many `ids` at a time. */
const IDS_PER_READ = 20;

type ApiMemberPick = NonNullable<ApiData<'/app/memberships', 'get'>>[number];
type ApiBranchRoom = NonNullable<
  ApiData<'/app/branches/{branch_id}/rooms', 'get'>
>[number];

const memberNameWire = wireSchema<ApiMemberPick>()(
  z.object({ id: z.string(), display_name: z.string() }),
);

const branchRoomWire = wireSchema<ApiBranchRoom>()(
  z.object({ id: z.string(), name: z.string() }),
);

/** The active organization — every key carries it, so two organizations never share a name. */
const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

/** TanStack Query keys for the directory's reads. */
const directoryQueryKeys = {
  all: ['clinic', 'directory'] as const,
  memberNames: (ids: readonly string[]) =>
    [...directoryQueryKeys.all, activeOrganizationId(), 'member-names', ids] as const,
  roomNames: (branchId: string) =>
    [...directoryQueryKeys.all, activeOrganizationId(), 'room-names', branchId] as const,
};

async function readMemberNames(ids: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let start = 0; start < ids.length; start += IDS_PER_READ) {
    const response = await api.get('/app/memberships', {
      query: {
        ids: ids.slice(start, start + IDS_PER_READ).join(','),
        include_ended: 'true',
      },
    });
    for (const row of z.array(memberNameWire).parse(response.data ?? [])) {
      names.set(row.id, row.display_name);
    }
  }
  return names;
}

/**
 * The display names of these members (`mem_…` → "Dr. Nisha Shah"), ended members included — a
 * past booking keeps its doctor. An id the API does not answer for is left out.
 */
export async function fetchMemberNames(
  ids: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const wanted = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  if (wanted.length === 0) return new Map();
  return queryClient.query({
    queryKey: directoryQueryKeys.memberNames(wanted),
    queryFn: () => readMemberNames(wanted),
    staleTime: DIRECTORY_STALE_MS,
  });
}

async function readRoomNames(branchId: string): Promise<Map<string, string>> {
  const response = await api.get('/app/branches/{branch_id}/rooms', {
    params: { branch_id: branchId },
    query: { limit: 100 },
  });
  return new Map(
    z
      .array(branchRoomWire)
      .parse(response.data ?? [])
      .map((row) => [row.id, row.name]),
  );
}

/** The names of one branch's rooms (`room_…` → "Room 2"), inactive ones included. */
export async function fetchRoomNames(
  branchId: string,
): Promise<ReadonlyMap<string, string>> {
  return queryClient.query({
    queryKey: directoryQueryKeys.roomNames(branchId),
    queryFn: () => readRoomNames(branchId),
    staleTime: DIRECTORY_STALE_MS,
  });
}
