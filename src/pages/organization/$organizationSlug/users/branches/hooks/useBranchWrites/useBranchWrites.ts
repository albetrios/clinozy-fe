import { branchQueryKeys } from '@/shared/api/clinic/branches-api.ts';
import type { BranchSave } from '@/shared/api/clinic/branches-contracts.ts';
import { removeBranch, saveBranch } from '@/shared/api/clinic/branches-manage-api.ts';
import type { Branch, DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { staffQueryKeys } from '@/shared/api/clinic/users-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/**
 * Save a branch from the branch drawer (`saveBranch`): not optimistic
 * ("Saving…") and silent — the drawer's toast names the branch ("Vesu branch
 * added" / "Vesu saved"). Refreshes every branch read (the list and the
 * header picker, so one-open-branch mode follows at once) and the staff
 * profiles its Team change moved.
 */
export function useSaveBranch(options: CrudMutationOptions<Branch, BranchSave> = {}) {
  return useAppMutation<Branch, BranchSave>({
    mutationFn: saveBranch,
    invalidateKeys: [branchQueryKeys.all, staffQueryKeys.all],
    // The drawer shows a failure in place: "Not saved · your changes are kept".
    notifyOnError: false,
    ...options,
  });
}

/** What a branch removal sends: the branch and the Reason confirm's choice. */
export interface BranchRemoveVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a branch when its deferred removal lands (after the Undo window).
 * Silent: the Reason confirm's "Vesu removed" + Undo owns the messages.
 */
export function useRemoveBranch() {
  return useAppMutation<Branch, BranchRemoveVars>({
    mutationFn: ({ id, reason, note }) => removeBranch(id, reason, note),
    invalidateKeys: [branchQueryKeys.all, staffQueryKeys.all],
  });
}
