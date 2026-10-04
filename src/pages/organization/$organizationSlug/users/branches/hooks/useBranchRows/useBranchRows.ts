import { useCallback, useMemo } from 'react';

import { branchListKey, fetchBranches } from '@/shared/api/clinic/branches-manage-api.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useTeam } from '@/shared/hooks/useTeam/index.ts';

/** A branch's default people, in the cell's order (H:5199). */
export const BRANCH_DEFAULT_ROLES = [
  'doctor',
  'desk',
  'therapist',
  'pharmacist',
] as const;

/** One of a branch's default people. */
export type BranchDefaultRole = (typeof BRANCH_DEFAULT_ROLES)[number];

/** The branch field naming each default person. */
export const BRANCH_DEFAULT_FIELDS = {
  doctor: 'defaultDoctorId',
  desk: 'defaultDeskId',
  therapist: 'defaultTherapistId',
  pharmacist: 'defaultPharmacistId',
} as const satisfies Readonly<Record<BranchDefaultRole, keyof Branch>>;

/** A branch as the Branches table shows it. */
export interface BranchRow {
  branch: Branch;
  /** The active Team members who work here, in the Team's order. */
  team: TeamMember[];
  /** The default people the Team has, Doctor · Desk · Therapist · Pharmacy. */
  defaults: { role: BranchDefaultRole; member: TeamMember }[];
}

/** The Team member a staff profile id names, if the Team has one. */
export function teamMemberByProfileId(
  members: readonly TeamMember[],
): (profileId: string | null) => TeamMember | undefined {
  const byProfile = new Map(
    members.flatMap((member) => (member.profile ? [[member.profile.id, member]] : [])),
  );
  return (profileId) => (profileId ? byProfile.get(profileId) : undefined);
}

/** A branch's row: its active people and the default people the Team still has. */
export function branchRowOf(branch: Branch, members: readonly TeamMember[]): BranchRow {
  const member = teamMemberByProfileId(members);
  return {
    branch,
    team: members.filter(
      (candidate) =>
        candidate.status === 'active' &&
        candidate.profile !== null &&
        candidate.branchIds.includes(branch.id),
    ),
    defaults: BRANCH_DEFAULT_ROLES.flatMap((role) => {
      const person = member(branch[BRANCH_DEFAULT_FIELDS[role]]);
      return person ? [{ role, member: person }] : [];
    }),
  };
}

/** The Branches tab's rows and the state of their reads. */
export interface BranchRowsResult {
  rows: BranchRow[];
  /** The Team, for the drawer's people pickers. */
  members: TeamMember[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Users › Branches' data (KICKOFF §6.12 Data): every branch, open and closed —
 * the main branch first, then as opened (fixture, REPLACE_WITH_API) — joined
 * with the Team: who works at each (their profile's branches) and its default
 * people. The list sits under the branches key prefix, so a branch write
 * refreshes the header picker as well.
 */
export function useBranchRows(): BranchRowsResult {
  const list = useAppQuery({
    queryKey: branchListKey(),
    queryFn: fetchBranches,
    // The page renders this failure in place: the last copy and a Retry (§6.0).
    notifyOnError: false,
  });
  const team = useTeam();
  const rows = useMemo(
    () => (list.data ?? []).map((branch) => branchRowOf(branch, team.members)),
    [list.data, team.members],
  );
  const { refetch: refetchList } = list;
  const { refetch: refetchTeam } = team;
  const refetch = useCallback(() => {
    void refetchList();
    refetchTeam();
  }, [refetchList, refetchTeam]);
  return {
    rows,
    members: team.members,
    isPending: list.isPending || (team.isPending && team.members.length === 0),
    isError: list.isError || team.isError,
    refetch,
  };
}
