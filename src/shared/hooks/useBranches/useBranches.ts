import { useQuery } from '@tanstack/react-query';

import {
  branchQueryKeys,
  fetchActiveBranches,
} from '@/shared/api/clinic/branches-api.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';

/** The clinic's active branches (main first) and whether they have loaded. */
export interface UseBranchesResult {
  branches: Branch[];
  isPending: boolean;
}

/** The clinic's active branches — the header branch picker and every branch field read this. */
export function useBranches(): UseBranchesResult {
  const query = useQuery({
    queryKey: branchQueryKeys.active(),
    queryFn: fetchActiveBranches,
    staleTime: 5 * 60_000,
  });
  return { branches: query.data ?? [], isPending: query.isPending };
}
