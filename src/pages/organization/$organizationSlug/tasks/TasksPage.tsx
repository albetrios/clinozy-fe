import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationTask, organizationTaskCreate } from '@/lib/routes/tasks-builders.ts';
import type {
  TaskRow,
  TaskScope,
  TaskTab,
  TaskType,
} from '@/shared/api/app/tasks-contracts.ts';
import {
  type AppCommandNavigation,
  appCommandNavigation,
} from '@/shared/app/app-command-targets.ts';
import { type TaskTarget, taskTargetNavigation } from '@/shared/app/task-targets.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { type AppAccess, useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useNow } from '@/shared/hooks/useNow/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import {
  useDeleteTask,
  useSaveTaskRuleSettings,
  useTaskList,
  useTaskRuleSettings,
} from '@/shared/hooks/useTasks/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { type NewTaskCreated, NewTaskDrawer } from './components/NewTaskDrawer/index.ts';
import { TaskDrawer } from './components/TaskDrawer/index.ts';
import { TaskList } from './components/TaskList/index.ts';
import type { TaskRulesPopoverProps } from './components/TaskRulesPopover/index.ts';
import { TasksToolbar } from './components/TasksToolbar/index.ts';
import { WhatsNextSheet } from './components/WhatsNextSheet/index.ts';
import { useTaskActions, type WhatsNextFor } from './hooks/useTaskActions/index.ts';
import { useTaskAssignees } from './hooks/useTaskAssignees/index.ts';
import { useTasksDialogRoute } from './hooks/useTasksDialogRoute/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TABLE_ID } from './tasks.constants.ts';
import { taskListQueryOf } from './tasks.params.ts';
import {
  TASKS_SEARCH_DEFAULTS,
  type TasksSearch,
  validateTasksSearch,
} from './tasks.search.ts';

/** What the member may do in the room — every flag `false` until their access resolves. */
interface TasksAccess {
  /** The room's reads (`task:read`; under View-as, the previewed role's view). */
  canView: boolean;
  /** "New task" (`task:create`). */
  canCreate: boolean;
  /** New task's Undo — a delete (`task:delete`). */
  canDelete: boolean;
  /** The rule switches and "Let Clinozy handle" (`organization:update`). */
  canEditRules: boolean;
}

/**
 * The room's gates (research-tasks §7): each its clinozy-be code in force — the member's own, or
 * the previewed role's while View-as runs.
 */
function tasksAccessOf(access: AppAccess): TasksAccess {
  const code = (permission: string) => access.isResolved && access.canCode(permission);
  return {
    canView: code('task:read'),
    canCreate: code('task:create'),
    canDelete: code('task:delete'),
    canEditRules: code('organization:update'),
  };
}

/**
 * The view the rows on screen belong to: the URL's once its read has settled,
 * the previous one while a new view, search or type loads — so the groups and
 * the empty line always match the rows (their text turns to bars meanwhile).
 */
function useShownView(view: TaskTab, settled: boolean): TaskTab {
  const [shown, setShown] = useState(view);
  if (settled && shown !== view) setShown(view);
  return settled ? view : shown;
}

/**
 * The list as the room shows it: one view of `GET /app/tasks` — the URL's
 * view, scope, types and search in the header's branches (D32, read once the
 * preferences have loaded) — read only with the room's view; the rows to show
 * (the last copy while a read fails, with the rooms' one list-error toast);
 * whether the card shows its bars, or the error with Retry in place.
 */
function useTaskListView(search: TasksSearch, canView: boolean, resolved: boolean) {
  const { preferences, isPending: preferencesPending } = usePreferences();
  const query = taskListQueryOf(search, preferences.branchFilter);
  const list = useTaskList(query, {
    notifyOnError: false,
    enabled: canView && !preferencesPending,
  });
  // A failed read with nothing to show keeps the last copy — and its view.
  const rows = useListLoadError(list, TASKS_TABLE_ID);
  const lastCopy = list.isError && list.rows.length === 0;
  // A member without the view reads nothing: their To do is empty, not loading.
  const loading = canView ? list.isPending : !resolved;
  const shownView = useShownView(query.tab, !(loading || list.isRefreshing || lastCopy));
  return {
    query,
    list,
    rows,
    loading,
    shownView,
    failed: list.isError && rows.length === 0 && !loading,
  };
}

/**
 * The Rules popover's state (`GET` / `PUT /app/task-rule-settings`): the
 * settings, a failed read's Retry, and a save per change for a member with
 * `organization:update`; the rows' "Clinozy can do this" reads the same
 * settings.
 */
function useTaskRules(canEdit: boolean) {
  const settings = useTaskRuleSettings();
  const save = useSaveTaskRuleSettings();
  const popover: TaskRulesPopoverProps = {
    settings: settings.data,
    failed: settings.isError && !settings.data,
    onRetry: () => void settings.refetch(),
    canEdit,
    onChange: (change) => save.mutate([change]),
  };
  const handled = (row: TaskRow) =>
    row.ruleKey !== null && (settings.data?.[row.ruleKey]?.isAutomatic ?? false);
  return { popover, handled };
}

/**
 * New task's way in and out: "New task" (toolbar, phone pill, the empty To do)
 * opens `/tasks/create` over the list for a member with `task:create`; a
 * created task closes it, the list stays, and "Task added for <owner> · <due>"
 * toasts (D28) — with Undo for a member with `task:delete`, which deletes it
 * (`DELETE /app/tasks/:task_id?reason=mistake`; the API has no other way back,
 * research-tasks Q7).
 */
function useNewTask(organizationSlug: string, close: () => void, gates: TasksAccess) {
  const { t } = useTranslation(TASKS_NS);
  const navigate = useNavigate();
  const remove = useDeleteTask();
  const open = gates.canCreate
    ? () =>
        void navigate({
          ...organizationTaskCreate(organizationSlug),
          search: true,
          hash: true,
        })
    : undefined;
  const onCreated = ({ task, owner, due }: NewTaskCreated) => {
    close();
    const message = t(TASKS_KEYS.newTask.added, { owner, due });
    if (!gates.canDelete) {
      notify.success(message);
      return;
    }
    notify.undo(message, {
      onUndo: () => remove.mutate({ taskId: task.id, reason: 'mistake', note: null }),
    });
  };
  return { open, onCreated };
}

/**
 * The person's contact card actions on a row and in the drawer: their patient
 * file, "+ Lead" and "+ Appointment" for the person's contact (kept behind by
 * `from=tasks`) — each offered only with its Create; none for a task about
 * nobody.
 */
function useTaskContactActions(organizationSlug: string) {
  const navigate = useAppNavigate();
  const access = useAppAccess();
  const tier = useViewportTier();
  const can = (section: 'leads' | 'appointments') =>
    access.isResolved && access.can(section, 'create');
  const go = (navigation: AppCommandNavigation) => void navigate(navigation);
  return (row: TaskRow): ContactCardActions => {
    const { person } = row;
    if (!person) return {};
    const { patientId } = person;
    return {
      onOpenPatientFile: patientId
        ? () =>
            go(
              appCommandNavigation('patient', {
                organizationSlug,
                recordId: patientId,
                // Activity open on tablet and desktop, closed on a phone (§6.6).
                search: { activity: tier === 'phone' ? 'closed' : 'open' },
              }),
            )
        : undefined,
      onNewLead: can('leads')
        ? () =>
            go({
              ...appCommandNavigation('newLead', { organizationSlug }),
              search: {
                name: person.name,
                ...(person.phone ? { phone: person.phone } : {}),
              },
            })
        : undefined,
      onNewAppointment: can('appointments')
        ? () =>
            go(
              appCommandNavigation('newAppointment', {
                organizationSlug,
                referrer: 'tasks',
                // The booking is the person's (`who=` a contact id).
                search: { who: person.id },
              }),
            )
        : undefined,
    };
  };
}

/**
 * The task drawer's team, writes and "What’s next" (KICKOFF §6.10): a link
 * goes to its record or follow-on screen; a closing outcome opens "What’s
 * next for <first>?" over the list.
 */
function useTaskDrawer(organizationSlug: string, close: () => void) {
  const navigate = useAppNavigate();
  const assignees = useTaskAssignees();
  const [whatsNext, setWhatsNext] = useState<WhatsNextFor | null>(null);
  const openTarget = (target: TaskTarget) =>
    void navigate(taskTargetNavigation(target, organizationSlug, 'tasks'));
  const actions = useTaskActions({
    assignees,
    close,
    openTarget,
    openWhatsNext: setWhatsNext,
  });
  return {
    assignees,
    actions,
    openTarget,
    whatsNext,
    closeWhatsNext: () => setWhatsNext(null),
  };
}

/**
 * Tasks room (KICKOFF §6.10; `tasks.md`) on clinozy-be: the toolbar — "To do ·
 * Snoozed · Done", search, type, "Mine · Everyone", Rules and "New task" (a
 * floating pill on a phone) — over the grouped list (`GET /app/tasks`), polled
 * every 60s, 50 a page, in the header's branches. The view, search, type and
 * scope live in the URL; the list read follows them. A row opens the task
 * drawer's dialog route (`$taskId/`) and "New task" its own (`create/`); both
 * render nothing: this page reads them.
 */
export function TasksPage() {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateTasksSearch(useSearch({ strict: false }));
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const gates = tasksAccessOf(access);
  const { t } = useTranslation(TASKS_NS);
  const now = useNow();
  const { dialog, close } = useTasksDialogRoute();
  const newTask = useNewTask(organizationSlug, close, gates);

  const view = useTaskListView(search, gates.canView, access.isResolved);
  const rules = useTaskRules(gates.canEditRules);
  const contactActions = useTaskContactActions(organizationSlug);
  const drawer = useTaskDrawer(organizationSlug, close);
  const team = useTeamDirectory();
  const rowTeam = {
    byId: drawer.assignees.byId,
    myMembershipId: drawer.assignees.myMembershipId,
    updatedAt: team.updatedAt,
  };

  const openTask = (row: TaskRow) =>
    void navigate({
      ...organizationTask(organizationSlug, row.id),
      search: true,
      hash: true,
    });

  return (
    <section data-testid="tasks-page" className="flex min-h-0 flex-1 flex-col">
      <TasksToolbar
        view={view.query.tab}
        onViewChange={(tab: TaskTab) =>
          patchSearch({ tab: tab === TASKS_SEARCH_DEFAULTS.tab ? undefined : tab })
        }
        types={view.query.type}
        onTypesChange={(types: TaskType[]) =>
          patchSearch({ type: types.length > 0 ? types : undefined })
        }
        scope={view.query.scope}
        onScopeChange={(scope: TaskScope) =>
          patchSearch({
            scope: scope === TASKS_SEARCH_DEFAULTS.scope ? undefined : scope,
          })
        }
        rules={rules.popover}
        onNewTask={newTask.open}
      />
      <TaskList
        tab={view.shownView}
        rows={view.rows}
        loading={view.loading}
        refreshing={view.list.isRefreshing}
        failed={view.failed}
        onRetry={view.list.refetch}
        now={now}
        handled={rules.handled}
        team={rowTeam}
        onOpen={openTask}
        contactActions={contactActions}
        hasNextPage={view.list.hasNextPage}
        isFetchingNextPage={view.list.isFetchingNextPage}
        fetchNextPage={view.list.fetchNextPage}
      />
      {dialog.kind === 'create' ? (
        <NewTaskDrawer
          prefill={dialog.prefill}
          onClose={close}
          onCreated={newTask.onCreated}
        />
      ) : null}
      {dialog.kind === 'task' ? (
        <TaskDrawer
          key={dialog.taskId}
          detail={dialog.detail}
          now={now}
          actions={drawer.actions}
          assignees={drawer.assignees}
          onClose={close}
          onOpenTarget={drawer.openTarget}
          contactActions={dialog.detail ? contactActions(dialog.detail.task) : undefined}
          pendingTitle={t(TASKS_KEYS.record)}
          failed={dialog.isError}
          onRetry={dialog.retry}
        />
      ) : null}
      {drawer.whatsNext ? (
        <WhatsNextSheet
          task={drawer.whatsNext.task}
          result={drawer.whatsNext.result}
          onClose={drawer.closeWhatsNext}
        />
      ) : null}
      <Outlet />
    </section>
  );
}
