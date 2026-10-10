import { useCallback, useMemo } from 'react';

import {
  fetchAllMembers,
  fetchAllRoles,
  joinTeam,
} from '@/shared/api/clinic/users-api.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The Team and the state of its read. */
export interface TeamResult {
  /** Every member, the newest #ID first. */
  members: TeamMember[];
  isPending: boolean;
  /** The roster failed to load — the Team shows its list error (§6.0). */
  isError: boolean;
  error: Error | null;
  /** Read the roster again (the list error's Retry). */
  refetch: () => void;
}

/**
 * The Team (KICKOFF §6.12 Data): every clinozy-be membership — all pages, read up front, under the
 * `members` key prefix, so every member write (`useInviteMember`, `useUpdateMember`,
 * `useRemoveMember`, the invitation writes) refreshes it. Search, filters and sorts run in place
 * (`teamMemberMatchesSearch`, `compareTeamMembers`). Read only with `membership:read`.
 */
export function useTeam(): TeamResult {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const selfUserId = useAuthStore((state) => state.user?.id ?? null);
  const canReadMembers = useCan({ permission: 'membership:read' });
  const members = useAppQuery({
    queryKey: orgQueryKeys.membersAll(organizationId),
    queryFn: fetchAllMembers,
    enabled: Boolean(organizationId) && canReadMembers,
    // The Team renders this failure in place: the last copy and a Retry (§6.0).
    notifyOnError: false,
  });
  const team = useMemo(
    () => joinTeam(members.data ?? [], selfUserId),
    [members.data, selfUserId],
  );
  const { refetch: refetchMembers } = members;
  const refetch = useCallback(() => void refetchMembers(), [refetchMembers]);
  return {
    members: team,
    isPending: canReadMembers && members.isPending,
    isError: members.isError,
    error: members.error,
    refetch,
  };
}

const NO_ROLES: RoleSummary[] = [];

/** The organization's roles and the state of their read. */
export interface PlatformRolesResult {
  /** Every role in creation order; empty while loading, or when the viewer can't read roles. */
  roles: RoleSummary[];
  /** True while a read the viewer may make is still loading. */
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Every role with its management fields (description, member count, lock) — all pages, under the
 * `roles` key prefix, so every role write refreshes it — for a viewer holding `role:read`;
 * nothing (and never pending) for anyone else. Roles & access, the Team's role pills and the
 * member drawer's role picker read it; anyone may read the role directory instead
 * (`useClinicRoles`).
 */
export function usePlatformRoles(enabled = true): PlatformRolesResult {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const canReadRoles = useCan({ permission: 'role:read' }) && enabled;
  const query = useAppQuery({
    queryKey: orgQueryKeys.rolesAll(organizationId),
    queryFn: fetchAllRoles,
    enabled: Boolean(organizationId) && canReadRoles,
    // Its readers render this failure in place (§6.0).
    notifyOnError: false,
  });
  const { refetch: refetchRoles } = query;
  const refetch = useCallback(() => void refetchRoles(), [refetchRoles]);
  return {
    roles: query.data ?? NO_ROLES,
    isPending: canReadRoles && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
