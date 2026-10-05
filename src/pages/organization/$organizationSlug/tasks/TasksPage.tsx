import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationTask, organizationTaskCreate } from '@/lib/routes/tasks-builders.ts';
import type {
  TaskRow,
  TaskRuleId,
  TaskScope,
  TaskTab,
} from '@/shared/api/clinic/tasks-contracts.ts';
import {
  type ClinicCommandNavigation,
  clinicCommandNavigation,
} from '@/shared/clinic/clinic-command-targets.ts';
import { type TaskTarget, taskTargetNavigation } from '@/shared/clinic/task-targets.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useNow } from '@/shared/hooks/useNow/index.ts';
import {
  useSaveTaskRuleSetting,
  useTaskList,
  useTaskRuleSettings,
  useUndoTaskChange,
} from '@/shared/hooks/useTasks/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { type NewTaskCreated, NewTaskDrawer } from './components/NewTaskDrawer/index.ts';
import { TaskDrawer } from './components/TaskDrawer/index.ts';
import { TaskList } from './components/TaskList/index.ts';
import { TasksToolbar } from './components/TasksToolbar/index.ts';
import { WhatsNextSheet } from './components/WhatsNextSheet/index.ts';
import { useTaskActions, type WhatsNextFor } from './hooks/useTaskActions/index.ts';
import { useTaskAssignees } from './hooks/useTaskAssignees/index.ts';
import { useTasksDialogRoute } from './hooks/useTasksDialogRoute/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TABLE_ID } from './tasks.constants.ts';
import { taskListQueryOf } from './tasks.params.ts';
import { TASKS_SEARCH_DEFAULTS, validateTasksSearch } from './tasks.search.ts';

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
 * New task's way in and out: "New task" (toolbar, phone pill, the empty To do)
 * opens `/tasks/create` over the list for a member with Create; a created task
 * closes it, the list stays, and "Task added for <owner> · <due>" offers Undo
 * (D28).
 */
function useNewTask(organizationSlug: string, close: () => void) {
  const { t } = useTranslation(TASKS_NS);
  const navigate = useNavigate();
  const access = useClinicAccess();
  const undo = useUndoTaskChange();
  const open =
    access.isResolved && access.can('tasks', 'create')
      ? () =>
          void navigate({
            ...organizationTaskCreate(organizationSlug),
            search: true,
            hash: true,
          })
      : undefined;
  const onCreated = ({ change, owner, due }: NewTaskCreated) => {
    close();
    notify.undo(t(TASKS_KEYS.newTask.added, { owner, due }), {
      onUndo: () => undo.mutate(change.undoToken),
    });
  };
  return { open, onCreated };
}

/**
 * The person's contact card actions on a row and in the drawer: their patient
 * file, "+ Lead" and "+ Appointment" (kept behind by `from=tasks`) — each
 * offered only with its Create.
 */
function useTaskContactActions(organizationSlug: string) {
  const navigate = useNavigate();
  const access = useClinicAccess();
  const tier = useViewportTier();
  const can = (section: 'leads' | 'appointments', action: 'create') =>
    access.isResolved && access.can(section, action);
  const go = (navigation: ClinicCommandNavigation) => void navigate(navigation);
  return (row: TaskRow): ContactCardActions => {
    const { person } = row;
    const who = person.patientId ?? person.leadId;
    return {
      onOpenPatientFile: person.patientId
        ? () =>
            go(
              clinicCommandNavigation('patient', {
                organizationSlug,
                recordId: person.patientId ?? undefined,
                // Activity open on tablet and desktop, closed on a phone (§6.6).
                search: { activity: tier === 'phone' ? 'closed' : 'open' },
              }),
            )
        : undefined,
      onNewLead: can('leads', 'create')
        ? () =>
            go({
              ...clinicCommandNavigation('newLead', { organizationSlug }),
              search: {
                name: person.name,
                ...(person.phone ? { phone: person.phone } : {}),
              },
            })
        : undefined,
      onNewAppointment:
        can('appointments', 'create') && who
          ? () =>
              go(
                clinicCommandNavigation('newAppointment', {
                  organizationSlug,
                  referrer: 'tasks',
                  search: { who },
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
  const navigate = useNavigate();
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
 * Tasks room (KICKOFF §6.10; `tasks.md`): the toolbar — "To do · Snoozed ·
 * Done", search, type, "Mine · Everyone", Rules and "New task" (a floating pill
 * on a phone) — over the grouped list, polled every 60s, 50 a page. The view,
 * search, type and scope live in the URL; the list read follows them. A row
 * opens the task drawer's dialog route (`$taskId/`) and "New task" its own
 * (`create/`); both render nothing: this page reads them. A Done entry with no
 * task behind it — a visit a WhatsApp "Yes" confirmed — toasts its result
 * instead (H:4270).
 */
export function TasksPage() {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateTasksSearch(useSearch({ strict: false }));
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const { t } = useTranslation(TASKS_NS);
  const now = useNow();
  const { dialog, close } = useTasksDialogRoute();
  const newTask = useNewTask(organizationSlug, close);

  const query = taskListQueryOf(search);
  const list = useTaskList(query, { notifyOnError: false });
  // A failed read with nothing to show keeps the last copy — and its view.
  const rows = useListLoadError(list, TASKS_TABLE_ID);
  const lastCopy = list.isError && list.rows.length === 0;
  const shownView = useShownView(
    query.tab,
    !(list.isPending || list.isRefreshing || lastCopy),
  );

  const ruleSettings = useTaskRuleSettings();
  const saveRule = useSaveTaskRuleSetting();
  const canEditRules = access.roles.some((role) => role === 'owner' || role === 'admin');
  const contactActions = useTaskContactActions(organizationSlug);
  const drawer = useTaskDrawer(organizationSlug, close);

  const openTask = (row: TaskRow) => {
    if (!row.exists) {
      if (row.result) notify.info(row.result);
      return;
    }
    void navigate({
      ...organizationTask(organizationSlug, row.id),
      search: true,
      hash: true,
    });
  };

  return (
    <section data-testid="tasks-page" className="flex min-h-0 flex-1 flex-col">
      <TasksToolbar
        view={query.tab}
        onViewChange={(tab: TaskTab) =>
          patchSearch({ tab: tab === TASKS_SEARCH_DEFAULTS.tab ? undefined : tab })
        }
        types={query.type}
        onTypesChange={(types: TaskRuleId[]) =>
          patchSearch({ type: types.length > 0 ? types : undefined })
        }
        scope={query.scope}
        onScopeChange={(scope: TaskScope) =>
          patchSearch({
            scope: scope === TASKS_SEARCH_DEFAULTS.scope ? undefined : scope,
          })
        }
        ruleSettings={ruleSettings.data}
        canEditRules={canEditRules}
        onRuleChange={(rule, patch) => saveRule.mutate({ rule, ...patch })}
        onNewTask={newTask.open}
      />
      <TaskList
        tab={shownView}
        rows={rows}
        loading={list.isPending}
        refreshing={list.isRefreshing}
        now={now}
        handled={(rule) => ruleSettings.data?.[rule]?.handled ?? false}
        onOpen={openTask}
        contactActions={contactActions}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={list.fetchNextPage}
        onNewTask={newTask.open}
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
