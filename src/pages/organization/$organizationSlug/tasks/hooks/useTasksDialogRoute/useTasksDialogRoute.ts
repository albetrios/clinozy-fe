import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationTasks } from '@/lib/routes/index.ts';
import { fetchTask, taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import type { TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/** The dialog the Tasks URL opens over the list (KICKOFF §4, D24). */
export type TasksDialogRoute =
  | { kind: 'none' }
  /** `/tasks/$taskId` — the task drawer; `detail` arrives once loaded. */
  | { kind: 'task'; taskId: string; detail: TaskDetail | undefined; isPending: boolean };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface TasksDialogRouteState {
  dialog: TasksDialogRoute;
  close: () => void;
}

/**
 * Which dialog the URL opens over the Tasks list — the room's dialog route
 * renders nothing, so the page reads it here. A task id that names no task (a
 * stale link, a removed task) opens nothing: the URL goes back to `/tasks` in
 * place, its view and filters kept, with "Task not found · it may have been
 * deleted" (`S:115`). `close` returns to the list the same way.
 */
export function useTasksDialogRoute(): TasksDialogRouteState {
  const { organizationSlug = '', taskId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(TASKS_NS);

  const close = useCallback(() => {
    void navigate({
      ...organizationTasks(organizationSlug),
      search: true,
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const drawer = useDialogRouteRecord({
    id: taskId,
    queryKey: taskQueryKeys.detail,
    fetchRecord: fetchTask,
    recordLabel: t(TASKS_KEYS.record),
    onMissing: close,
  });

  if (taskId === undefined || !drawer.isOpen) return { dialog: { kind: 'none' }, close };
  return {
    dialog: { kind: 'task', taskId, detail: drawer.record, isPending: drawer.isPending },
    close,
  };
}
