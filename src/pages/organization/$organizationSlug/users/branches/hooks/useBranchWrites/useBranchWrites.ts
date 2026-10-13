import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import type { AppBranch, BranchSave } from '@/shared/api/app/branches-contracts.ts';
import { saveBranch } from '@/shared/api/app/branches-manage-api.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Save a branch from the branch drawer (`saveBranch`): not optimistic ("Saving…") and silent —
 * the drawer's toast names the branch ("Vesu branch added" / "Vesu saved") and shows a failure
 * in place. Refreshes every branch read (the list and the header picker, so one-open-branch mode
 * follows at once) and the Team, whose members' branches the team change moved.
 */
export function useSaveBranch() {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppMutation<AppBranch, BranchSave>({
    mutationFn: (save, action) =>
      saveBranch({ save, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [branchQueryKeys.all, orgQueryKeys.members(organizationId)],
    // The drawer shows a failure in place: "Not saved · your changes are kept".
    notifyOnError: false,
  });
}
