import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { servedTone } from '@/shared/app/app-tones.ts';
import { personInitials } from '@/shared/components/Cells/PersonAvatar/person-name.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { presetOfRole } from './access-contracts.ts';
import type { Role, Tone } from './app-schema.ts';

/*
 * The team and the names a room's rows point at by id — a booking's doctor
 * (`doctor_membership_id`), its room (`branch_room_id`), a lead's owner — from the member picker
 * every member reads, resolved in one read per set, never one per row, and kept for a few
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

const teamMemberWire = wireSchema<ApiMemberPick>()(
  z.object({
    id: z.string(),
    user_id: z.string(),
    display_name: z.string(),
    tone: z.string(),
    role_ids: z.array(z.string()),
    branch_ids: z.array(z.string()),
    is_active: z.boolean(),
  }),
);

type ApiRoleDirectoryRow = NonNullable<ApiData<'/app/roles', 'get'>>[number];

const roleDirectoryWire = wireSchema<ApiRoleDirectoryRow>()(
  z.object({
    id: z.string(),
    name: z.string(),
    tone: z.string(),
    is_system: z.boolean(),
    is_locked: z.boolean(),
  }),
);

const branchRoomWire = wireSchema<ApiBranchRoom>()(
  z.object({ id: z.string(), name: z.string() }),
);

/** The active organization — every key carries it, so two organizations never share a name. */
const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

/** TanStack Query keys for the directory's reads. */
const directoryQueryKeys = {
  all: ['app', 'directory'] as const,
  memberNames: (ids: readonly string[]) =>
    [...directoryQueryKeys.all, activeOrganizationId(), 'member-names', ids] as const,
  roomNames: (branchId: string) =>
    [...directoryQueryKeys.all, activeOrganizationId(), 'room-names', branchId] as const,
};

/** The query key of the role directory in one organization. */
export const roleDirectoryQueryKey = (organizationId: string | null) =>
  [...directoryQueryKeys.all, organizationId, 'roles'] as const;

/** A role as every member may read it — a pill's name and tone, a preset's key. */
export interface DirectoryRole {
  id: string;
  name: string;
  /** The role's colour — the palette's, else the name's own hashed tone. */
  tone: Tone;
  isSystem: boolean;
  isLocked: boolean;
  /** The preset it is (a system role named as one), else null for the clinic's own role. */
  preset: Role | null;
}

/**
 * The organization's roles by name and tone — every page of the role directory
 * (`GET /app/roles`, any member reads it): the Account menu's role line, a View-as preview's
 * name, the role pills a member without `role:read` sees.
 */
export async function fetchRoleDirectory(): Promise<DirectoryRole[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/roles', {
      query: { limit: 100, after: after ?? undefined },
    });
    return {
      rows: z.array(roleDirectoryWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'role-directory');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tone: servedTone(row.tone, row.name),
    isSystem: row.is_system,
    isLocked: row.is_locked,
    preset: presetOfRole({ name: row.name, isSystem: row.is_system }),
  }));
}

/** The query key of the team in one organization (the hook passes the organization it renders for). */
export const teamDirectoryQueryKey = (organizationId: string | null) =>
  [...directoryQueryKeys.all, organizationId, 'team'] as const;

/** A member of the team as the pickers, avatars and owner chips read them. */
export interface DirectoryMember {
  /** The membership id (`mem_…`) — what an owner, an author or an assignee points at. */
  id: string;
  userId: string;
  /** "Dr. Nisha Shah". */
  name: string;
  /** "NS". */
  initials: string;
  /** The member's colour — the palette's, else the name's own hashed tone. */
  tone: Tone;
  roleIds: string[];
  branchIds: string[];
}

/** A picker row as the rooms read it. */
function toDirectoryMember(row: z.output<typeof teamMemberWire>): DirectoryMember {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.display_name,
    initials: personInitials(row.display_name),
    tone: servedTone(row.tone, row.display_name),
    roleIds: row.role_ids,
    branchIds: row.branch_ids,
  };
}

/**
 * The organization's active members by name — every page of the member picker
 * (`GET /app/memberships`, any member reads it).
 */
export async function fetchTeamDirectory(): Promise<DirectoryMember[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/memberships', {
      query: { limit: 100, after: after ?? undefined, include_ended: 'false' },
    });
    return {
      rows: z.array(teamMemberWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'team-directory');
  return rows.filter((row) => row.is_active).map(toDirectoryMember);
}

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
