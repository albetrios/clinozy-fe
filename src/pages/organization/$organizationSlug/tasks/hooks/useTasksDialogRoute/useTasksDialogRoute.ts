import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { PUBLIC_ID } from '@/lib/routes/search-params.ts';
import { organizationTasks } from '@/lib/routes/tasks-builders.ts';
import { fetchTask, taskQueryKeys } from '@/shared/api/app/tasks-api.ts';
import type { TaskDetail } from '@/shared/api/app/tasks-contracts.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import {
  type TaskCreateSearch,
  validateTaskCreateSearch,
} from '../../tasks.dialog-search.ts';
import { validateTasksSearch } from '../../tasks.search.ts';

/** The dialog the Tasks URL opens over the list (KICKOFF §4, D24). */
export type TasksDialogRoute =
  | { kind: 'none' }
  /** `/tasks/create` — New task, for the `?lead=` / `?contact=` it names (`S:96`, Q-T4). */
  | { kind: 'create'; prefill: TaskCreateSearch }
  /** `/tasks/$taskId` — the task drawer; `detail` arrives once loaded. */
  | {
      kind: 'task';
      taskId: string;
      detail: TaskDetail | undefined;
      isPending: boolean;
      /** The read failed (a dropped connection, a 5xx): the drawer shows Retry in place. */
      isError: boolean;
      /** Read the task again. */
      retry: () => void;
    };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface TasksDialogRouteState {
  dialog: TasksDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/tasks\/create\/?$/;

/** A task's public id (`task_` + 21) — anything else is "not found" without a read. */
const isTaskId = (id: string) => id.startsWith('task_') && PUBLIC_ID.test(id);

/**
 * Which dialog the URL opens over the Tasks list — the room's dialog routes
 * render nothing, so the page reads them here. The task drawer reads its task
 * (`GET /app/tasks/:task_id` with its person, record and quote — `fetchTask`,
 * each part only under its read code) once the member's codes are known; an
 * id that names no task (a stale link, a removed task, a link from the
 * fixture days) opens nothing: the URL goes back to `/tasks` in place, its
 * view and filters kept, with "Task not found · it may have been deleted"
 * (`S:115`). A member without `task:create` who follows a New task link lands
 * back on the list with the permission toast. `close` returns to the list with
 * its view, search, types and scope — and nothing of New task's prefill.
 */
export function useTasksDialogRoute(): TasksDialogRouteState {
  const { organizationSlug = '', taskId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(TASKS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const access = useAppAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);

  const close = useCallback(() => {
    void navigate({
      ...organizationTasks(organizationSlug),
      search: (current: Record<string, unknown>) => validateTasksSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  // The record and quote reads follow the member's codes: read only once they are known.
  const drawer = useDialogRouteRecord({
    id: access.isResolved ? taskId : undefined,
    queryKey: (id) => taskQueryKeys.detail(organizationId, id),
    fetchRecord: (id) => fetchTask(id, access.canCode),
    recordLabel: t(TASKS_KEYS.record),
    onMissing: close,
    isWellFormed: isTaskId,
  });

  const isCreate = CREATE_PATH.test(pathname);
  const refused = isCreate && access.isResolved && !access.canCode('task:create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(tErrors(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, tErrors]);

  if (taskId !== undefined) {
    const opening = !access.isResolved;
    return drawer.isOpen || opening
      ? {
          dialog: {
            kind: 'task',
            taskId,
            detail: drawer.record,
            isPending: opening || drawer.isPending,
            isError: drawer.isError,
            retry: drawer.refetch,
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
