import { useCallback, useMemo } from 'react';

import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  fetchAllMembers,
  fetchAllRoles,
  fetchMyStaffProfile,
  fetchStaffProfiles,
  joinTeam,
  removeStaffProfile,
  saveStaffProfile,
  staffQueryKeys,
} from '@/shared/api/clinic/users-api.ts';
import type {
  StaffProfile,
  StaffProfileInput,
  TeamMember,
} from '@/shared/api/clinic/users-contracts.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The Team and the state of its reads. */
export interface TeamResult {
  /** Every member ⨝ their staff profile, the newest #ID first. */
  members: TeamMember[];
  /** True until the roster and the profiles have both answered. */
  isPending: boolean;
  /** The roster or the profiles failed to load — the Team shows its list error (§6.0). */
  isError: boolean;
  error: Error | null;
  /** Read the roster and the profiles again (the list error's Retry). */
  refetch: () => void;
}

/**
 * The Team (KICKOFF §6.12 Data, D17): every clinozy-be membership — all pages,
 * read up front — joined with its staff profile (fixture, REPLACE_WITH_API).
 * The roster sits under the `members` key prefix, so every existing member
 * write (`useInviteMember`, `useUpdateMemberRole`, `useUpdateMemberStatus`,
 * `useRemoveMember`, the invitation writes) refreshes it. Search, filters and
 * sorts run in place (`teamMemberMatchesSearch`, `compareTeamMembers`).
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
  // The roles only say which platform roles are custom; without `role:read`
  // the Team still renders, with presets matched by name (least privilege).
  const platformRoles = usePlatformRoles();
  const profiles = useStaffProfiles();

  const team = useMemo(
    () =>
      joinTeam({
        members: members.data ?? [],
        profiles: profiles.data ?? [],
        platformRoles: platformRoles.roles,
        selfUserId,
      }),
    [members.data, profiles.data, platformRoles.roles, selfUserId],
  );

  const { refetch: refetchMembers } = members;
  const { refetch: refetchProfiles } = profiles;
  const refetch = useCallback(() => {
    void refetchMembers();
    void refetchProfiles();
  }, [refetchMembers, refetchProfiles]);

  return {
    members: team,
    isPending: members.isPending || profiles.isPending || platformRoles.isPending,
    isError: members.isError || profiles.isError,
    error: members.error ?? profiles.error ?? null,
    refetch,
  };
}

const NO_ROLES: RoleSummary[] = [];

/** The organisation's clinozy-be roles and the state of their read. */
export interface PlatformRolesResult {
  /** Every role; empty while loading, or when the viewer can't read roles. */
  roles: RoleSummary[];
  /** True while a read the viewer may make is still loading. */
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Every clinozy-be role — all pages, under the `roles` key prefix, so every
 * role write refreshes it — for a viewer holding `role:read`; nothing (and
 * never pending) for anyone else. The Team reads it for each platform role's
 * system flag, Roles & access for the roles themselves.
 */
export function usePlatformRoles(): PlatformRolesResult {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const canReadRoles = useCan({ permission: 'role:read' });
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

/**
 * Every live staff profile (fixture, REPLACE_WITH_API) — one cache entry with
 * the Team's join: the person pickers, the Leads room's team column, its Team
 * filter and the people popover read it, and the rooms' "Updated" cells for
 * who saved a record (its name, initials and tone).
 */
export function useStaffProfiles() {
  return useAppQuery({
    queryKey: staffQueryKeys.profiles(),
    queryFn: fetchStaffProfiles,
  });
}

/**
 * The signed-in member's staff profile, by their sign-in email — null when
 * they have none (REPLACE_WITH_API: the session carries it). Their clinic roles
 * (`useClinicAccess`) and "Mine" read this.
 */
export function useMyStaffProfile() {
  const email = useAuthStore((state) => state.user?.email ?? null);
  return useAppQuery({
    queryKey: staffQueryKeys.mine(email),
    queryFn: () => fetchMyStaffProfile(email),
    staleTime: 5 * 60_000,
  });
}

/**
 * Save a member's staff profile — the user drawer's second half, after
 * `useInviteMember` (new) or beside `useUpdateMemberRole` /
 * `useUpdateMemberStatus` (edit). Not optimistic ("Saving…"); silent, because
 * the drawer's toast names the person ("<name> added" / "<name> saved", D28).
 */
export function useSaveStaffProfile(
  options: CrudMutationOptions<StaffProfile, StaffProfileInput> = {},
) {
  return useAppMutation<StaffProfile, StaffProfileInput>({
    mutationFn: saveStaffProfile,
    invalidateKeys: [staffQueryKeys.all],
    ...options,
  });
}

/** What a profile removal sends: the profile and the Reason confirm's choice. */
export interface StaffProfileRemoveVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Remove a member's staff profile when their deferred removal lands (after the
 * Undo window, as `useRemoveMember` runs). Silent: the Reason confirm's
 * "<name> removed" + Undo owns the messages.
 */
export function useRemoveStaffProfile(
  options: CrudMutationOptions<StaffProfile, StaffProfileRemoveVars> = {},
) {
  return useAppMutation<StaffProfile, StaffProfileRemoveVars>({
    mutationFn: ({ id, reason, note }) => removeStaffProfile(id, reason, note),
    invalidateKeys: [staffQueryKeys.all],
    ...options,
  });
}
