import { useTranslation } from 'react-i18next';

import type { TaskRow } from '@/shared/api/app/tasks-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useDeleteTask, useRestoreTask } from '@/shared/hooks/useTasks/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/** Props of {@link TaskDeleteConfirm}. */
interface TaskDeleteConfirmProps {
  /** The task made by hand to delete; the confirm is open while one is set. */
  task: TaskRow | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the task is deleted: the drawer closes. */
  onDeleted: () => void;
}

/**
 * Delete a task made by hand (`task:delete`; a rule's task goes when its record
 * changes — `409 rule_task`): the shared reason confirm — "Delete this task?",
 * the task in a grey pill, the API's reasons (mistake · duplicate · not needed
 * · other, which needs a note) — then `DELETE /app/tasks/:task_id?reason&note`,
 * optimistic (the row leaves every list at once), and "<task> removed" whose
 * Undo restores it (`POST …/restore`, the same code).
 */
export function TaskDeleteConfirm({ task, onClose, onDeleted }: TaskDeleteConfirmProps) {
  const { t } = useTranslation(TASKS_NS);
  const remove = useDeleteTask();
  const restore = useRestoreTask();
  return (
    <ConfirmDialog
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(TASKS_KEYS.drawer.deleteTitle)}
      reason={{
        record: task?.title,
        undo: task
          ? {
              message: t(TASKS_KEYS.toasts.removed, { title: task.title }),
              onUndo: () => restore.mutateAsync(task.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!task) return;
        await remove.mutateAsync({ taskId: task.id, reason, note });
        onDeleted();
      }}
    />
  );
}
