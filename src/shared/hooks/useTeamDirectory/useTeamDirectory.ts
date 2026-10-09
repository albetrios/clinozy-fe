import { useMemo } from 'react';

import {
  type DirectoryMember,
  fetchTeamDirectory,
  teamDirectoryQueryKey,
} from '@/shared/api/clinic/directory-api.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The team and the state of its read. */
export interface TeamDirectory {
  /** The active members, by name. */
  members: readonly DirectoryMember[];
  /** A member by membership id. */
  byId: ReadonlyMap<string, DirectoryMember>;
  isPending: boolean;
  /** When the team was read — "Updated HH:MM" on a team card. */
  updatedAt: string | null;
}

const NO_MEMBERS: readonly DirectoryMember[] = [];

/**
 * The organization's active members (`GET /app/memberships`, every page) — the owner and
 * involved pickers, the avatars and the names a room's rows point at by membership id. Read once
 * an organization is active and kept five minutes.
 */
export function useTeamDirectory(): TeamDirectory {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const query = useAppQuery({
    queryKey: teamDirectoryQueryKey(organizationId),
    queryFn: fetchTeamDirectory,
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });
  const members = query.data ?? NO_MEMBERS;
  const byId = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  return {
    members,
    byId,
    isPending: query.isPending,
    updatedAt: query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : null,
  };
}
