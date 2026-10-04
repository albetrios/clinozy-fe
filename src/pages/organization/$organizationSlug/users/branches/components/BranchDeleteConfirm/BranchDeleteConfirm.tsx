import { useTranslation } from 'react-i18next';

import { branchListKey } from '@/shared/api/clinic/branches-manage-api.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useDeferredRowRemoval } from '@/shared/hooks/useDeferredRowRemoval/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useRemoveBranch } from '../../hooks/useBranchWrites/index.ts';

/** The Undo window of a removal (D32: Undo toasts run 10,000ms). */
const UNDO_MS = 10_000;

/** The branch a delete confirm is about. */
export interface BranchDeleteTarget {
  branch: Branch;
  /** The grey pill under the title: the name from a row, the drawer's summary line from a drawer. */
  record?: string;
}

/** Props of {@link BranchDeleteConfirm}. */
export interface BranchDeleteConfirmProps {
  /** The branch to delete; the confirm is open while one is set. */
  target: BranchDeleteTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the pick. */
  onClose: () => void;
  /** Runs once the removal is scheduled (the drawer closes itself). */
  onDeleted?: () => void;
}

/**
 * Delete a branch (KICKOFF §6.12 Delete confirm; `users.md:238–252`): the
 * shared reason confirm titled "Delete this branch?", asked once with the
 * branch's name (the prototype asks twice, first with the address — §7.3).
 * The row leaves at once and "Vesu removed" offers Undo for 10s; only then is
 * the branch deleted with the reason picked, and its people lose it. Never the
 * main branch: the screens offer no Delete there.
 */
export function BranchDeleteConfirm({
  target,
  onClose,
  onDeleted,
}: BranchDeleteConfirmProps) {
  const { t } = useTranslation(USERS_NS);
  const scheduleRemoval = useDeferredRowRemoval<Branch>(branchListKey());
  const removeBranch = useRemoveBranch();

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(USERS_KEYS.branches.deleteBranch.title)}
      reason={{ record: target ? (target.record ?? target.branch.name) : undefined }}
      onConfirm={({ reason, note }) => {
        if (!target) return;
        const { branch } = target;
        scheduleRemoval({
          id: branch.id,
          pendingMessage: t(USERS_KEYS.branches.deleteBranch.removed, {
            name: branch.name,
          }),
          toastId: `remove-branch-${branch.id}`,
          delayMs: UNDO_MS,
          commit: () => removeBranch.mutateAsync({ id: branch.id, reason, note }),
        });
        onDeleted?.();
      }}
    />
  );
}
