import { useCallback, useEffect } from 'react';

import { defaultBranchId } from '@/shared/app/app-branch.ts';
import {
  type BranchHours,
  branchHoursOf,
  DEFAULT_BRANCH_HOURS,
  rememberBranchHours,
} from '@/shared/app/branch-hours.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';

/**
 * A branch's clinic hours by its id — a task's, a booking's. With no id, or one no longer open,
 * the current branch's: the header's one branch, else the main one ({@link defaultBranchId}); the
 * default hours while the branches load or when the clinic has none.
 */
export function useBranchHours(): (branchId: string | null) => BranchHours {
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const { branchFilter } = preferences;
  return useCallback(
    (branchId) => {
      const current = defaultBranchId(openBranches, branchFilter);
      const branch =
        openBranches.find((candidate) => candidate.id === branchId) ??
        openBranches.find((candidate) => candidate.id === current);
      return branch ? branchHoursOf(branch) : DEFAULT_BRANCH_HOURS;
    },
    [openBranches, branchFilter],
  );
}

/**
 * Keep the current branch's hours on this device once the branches load, and again when the
 * header's branch changes — the sign-in screen's tour paints its sample day in them. Mounted in
 * the signed-in shell; a clinic with no open branch leaves what is kept.
 */
export function useRememberBranchHours(): void {
  const { openBranches } = useBranches();
  const hoursOf = useBranchHours();
  const hasBranches = openBranches.length > 0;
  useEffect(() => {
    if (hasBranches) rememberBranchHours(hoursOf(null));
  }, [hasBranches, hoursOf]);
}
