import { useCallback, useMemo } from 'react';

import type { AppBranch } from '@/shared/api/app/branches-contracts.ts';
import { branchListKey, fetchBranches } from '@/shared/api/app/branches-manage-api.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
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
} as const satisfies Readonly<Record<BranchDefaultRole, keyof AppBranch>>;

/** A branch as the Branches table shows it. */
export interface BranchRow {
  branch: AppBranch;
  /** The active Team members who work here, in the Team's order. */
  team: TeamMember[];
  /** The default people the Team has, Doctor · Desk · Therapist · Pharmacy. */
  defaults: { role: BranchDefaultRole; member: TeamMember }[];
}

/** The Team member a membership id names, if the Team has one. */
export function teamMemberById(
  members: readonly TeamMember[],
): (membershipId: string | null) => TeamMember | undefined {
  const byId = new Map(members.map((member) => [member.membershipId, member]));
  return (membershipId) => (membershipId ? byId.get(membershipId) : undefined);
}

/** A branch's row: its active people and the default people the Team still has. */
export function branchRowOf(
  branch: AppBranch,
  members: readonly TeamMember[],
): BranchRow {
  const member = teamMemberById(members);
  return {
    branch,
    team: members.filter(
      (candidate) =>
        candidate.status === 'active' && candidate.branchIds.includes(branch.id),
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
 * the main branch first, then as opened (`GET /app/branches`, `branch:read`) —
 * joined with the Team: who works at each (each membership's `branch_ids`) and
 * its default people. The list sits under the branches key prefix, so a branch write
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
