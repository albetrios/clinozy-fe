import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationTasks } from '@/lib/routes/index.ts';
import { fetchTask, taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import type { TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import {
  type TaskCreateSearch,
  validateTaskCreateSearch,
  validateTasksSearch,
} from '../../tasks.search.ts';

/** The dialog the Tasks URL opens over the list (KICKOFF §4, D24). */
export type TasksDialogRoute =
  | { kind: 'none' }
  /** `/tasks/create` — New task, for the `?lead=` / `?patient=` it names (`S:96`, Q-T4). */
  | { kind: 'create'; prefill: TaskCreateSearch }
  /** `/tasks/$taskId` — the task drawer; `detail` arrives once loaded. */
  | { kind: 'task'; taskId: string; detail: TaskDetail | undefined; isPending: boolean };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface TasksDialogRouteState {
  dialog: TasksDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/tasks\/create\/?$/;

/**
 * Which dialog the URL opens over the Tasks list — the room's dialog routes
 * render nothing, so the page reads them here. A task id that names no task (a
 * stale link, a removed task) opens nothing: the URL goes back to `/tasks` in
 * place, its view and filters kept, with "Task not found · it may have been
 * deleted" (`S:115`). A member without Create who follows a New task link
 * lands back on the list with the permission toast. `close` returns to the
 * list with its view, search, types and scope — and nothing of New task's
 * prefill.
 */
export function useTasksDialogRoute(): TasksDialogRouteState {
  const { organizationSlug = '', taskId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(TASKS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const access = useClinicAccess();

  const close = useCallback(() => {
    void navigate({
      ...organizationTasks(organizationSlug),
      search: (current: Record<string, unknown>) => validateTasksSearch(current),
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

  const isCreate = CREATE_PATH.test(pathname);
  const refused = isCreate && access.isResolved && !access.can('tasks', 'create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(tErrors(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, tErrors]);

  if (taskId !== undefined) {
    return drawer.isOpen
      ? {
          dialog: {
            kind: 'task',
            taskId,
            detail: drawer.record,
            isPending: drawer.isPending,
          },
          close,
        }
      : { dialog: { kind: 'none' }, close };
  }
  if (!isCreate || refused) return { dialog: { kind: 'none' }, close };
  // The prefill is parsed again here: from the list's own match the router
  // hands back the URL's raw values, not the create route's.
  return { dialog: { kind: 'create', prefill: validateTaskCreateSearch(search) }, close };
}
