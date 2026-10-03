import { useQuery } from '@tanstack/react-query';

import {
  branchQueryKeys,
  fetchActiveBranches,
} from '@/shared/api/clinic/branches-api.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';

/** The clinic's open branches (main first), whether there are several, and whether they have loaded. */
export interface UseBranchesResult {
  /** The open branches ("Open · shown in pickers"), the main branch first. */
  openBranches: Branch[];
  /**
   * Whether two or more branches are open. With one, the clinic shows no
   * branch UI at all: no header picker, no Branches field, filter or column
   * (`users.md:95`; KICKOFF §6.12 One open branch). False until loaded.
   */
  isMultiBranch: boolean;
  isPending: boolean;
}

/**
 * The clinic's open branches — the one source for the header branch picker,
 * the user drawer, Offerings and every Filters popover (KICKOFF §6.12 Data).
 */
export function useBranches(): UseBranchesResult {
  const query = useQuery({
    queryKey: branchQueryKeys.active(),
    queryFn: fetchActiveBranches,
    staleTime: 5 * 60_000,
  });
  const openBranches = query.data ?? [];
  return {
    openBranches,
    isMultiBranch: openBranches.length > 1,
    isPending: query.isPending,
  };
}
