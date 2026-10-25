import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import {
  addTask,
  countOpenTasks,
  deleteTask,
  fetchTask,
  fetchTaskRuleSettings,
  fetchTaskWorkerIds,
  listTasks,
  reassignTask,
  recordTaskOutcome,
  restoreTask,
  saveTaskRuleSettings,
  snoozeTask,
  TASK_SIDE_EFFECT_KEYS,
  type TaskOutcomeInput,
  taskQueryKeys,
} from '@/shared/api/app/tasks-api.ts';
import {
  findTaskOutcome,
  normalizeTaskListQuery,
  type TaskAssignee,
  type TaskFields,
  type TaskListQueryInput,
  type TaskRecord,
  type TaskRow,
  type TaskRuleSettingChange,
  type TaskRuleSettings,
  TASKS_REFETCH_MS,
  type TaskSnoozeOption,
  taskSnoozeUntil,
} from '@/shared/api/app/tasks-contracts.ts';
import type { BranchHours } from '@/shared/app/branch-hours.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import {
  type CursorListResult,
  useCursorList,
} from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

/*
 * Tasks' server state on clinozy-be (KICKOFF §6.10, one model with Today's queue, Q-T3): the list
 * and the drawer read again every 60s; every write refreshes the task reads and the records it
 * may have changed — and once more after the server's rules have run on it (D81 T7). Writes toast
 * only their errors — the rooms toast success themselves.
 */

/** What every task write may have changed. */
const TASK_WRITE_KEYS = [taskQueryKeys.all, ...TASK_SIDE_EFFECT_KEYS];

/**
 * How long after a write the server's rules run has settled (D81 T7): a message, a call, a
 * booking's status or a task's own outcome asks the rules to run after its commit, and they close,
 * open or wake tasks within about half a second on the local stack.
 */
const TASK_RULES_SETTLE_MS = 1_500;

/**
 * The task reads, refreshed once the rules a write asked for have run (D81 T7) — call it after a
 * message sent from a task's chat, or a booking's status moved where a task list shows, so the
 * task it settles leaves without waiting for the 60s poll.
 */
export function useRefreshTasksAfterRules(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
    }, TASK_RULES_SETTLE_MS);
  }, [queryClient]);
}

// ── Reads ──

/** Options for {@link useTaskList} and {@link useTask}. */
export interface TaskQueryOptions {
  enabled?: boolean;
  /** Toast a failed load (default: true); off when the room shows its own "Couldn’t load" toast. */
  notifyOnError?: boolean;
}

/**
 * One view of the list — To do, Snoozed or Done — scoped, filtered by type, searched, 50 a page
 * (`GET /app/tasks`, each page joined with its people), read again every 60s.
 */
export function useTaskList(
  query: TaskListQueryInput,
  options: TaskQueryOptions = {},
): CursorListResult<TaskRow> {
  const organizationId = useOrganizationId();
  return useCursorList<TaskRow>({
    queryKey: taskQueryKeys.list(organizationId, query),
    queryFn: async (after) => {
      const page = await listTasks(query, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    refetchInterval: TASKS_REFETCH_MS,
    notifyOnError: options.notifyOnError ?? true,
    enabled: organizationId !== null && (options.enabled ?? true),
  });
}

/**
 * One task for its drawer — the row, the record it points at and the message it quotes, each
 * read only with its read code; idle without an id, and until the member's access is known.
 */
export function useTask(
  taskId: string | null | undefined,
  options: TaskQueryOptions = {},
) {
  const organizationId = useOrganizationId();
  const access = useAppAccess();
  return useAppQuery({
    queryKey: taskQueryKeys.detail(organizationId, taskId ?? ''),
    queryFn: () => fetchTask(taskId ?? '', access.canCode),
    enabled:
      Boolean(taskId) &&
      organizationId !== null &&
      access.isResolved &&
      (options.enabled ?? true),
    refetchInterval: TASKS_REFETCH_MS,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** Options for {@link useOpenTaskCount}: the reads' options and the header's branches. */
interface OpenTaskCountOptions extends TaskQueryOptions {
  /** The header's branches (D32) — none: every branch. */
  branchIds?: readonly string[];
}

/**
 * How many tasks are open, whoever owns them, in the header's branches — Today's "<n> open";
 * read again every 60s.
 */
export function useOpenTaskCount(options: OpenTaskCountOptions = {}) {
  const organizationId = useOrganizationId();
  // Deduplicated and sorted, so equal filters share one cache entry.
  const branchIds =
    normalizeTaskListQuery({ branchIds: [...(options.branchIds ?? [])] }).branchIds ?? [];
  return useAppQuery({
    queryKey: taskQueryKeys.openCount(organizationId, branchIds),
    queryFn: () => countOpenTasks(branchIds),
    enabled: organizationId !== null && (options.enabled ?? true),
    refetchInterval: TASKS_REFETCH_MS,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/**
 * The members who can work tasks — they hold `task:read` (D81 T8): the assignee pickers offer
 * only them. Read once an organization is active and kept five minutes.
 */
export function useTaskWorkerIds() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: taskQueryKeys.workers(organizationId),
    queryFn: fetchTaskWorkerIds,
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });
}

/** Every rule's setting — on, handed to Clinozy, and whether Clinozy can (the Rules popover). */
export function useTaskRuleSettings() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: taskQueryKeys.ruleSettings(organizationId),
    queryFn: fetchTaskRuleSettings,
    enabled: organizationId !== null,
    staleTime: 5 * 60_000,
  });
}

// ── Writes ──

/** The rows without one task — it left its view (closed, snoozed, removed). */
const withoutTask = (rows: TaskRow[], taskId: string): TaskRow[] =>
  rows.filter((row) => row.id !== taskId);

/**
 * Record one of a task's outcomes — its record writes, then the task's resolve or snooze (the one
 * write Tasks and Today's queue share). A closing or snoozing outcome takes the row out of every
 * list at once and puts it back if the write fails; the reads refresh, and again once the rules
 * have run (a "Doing well" writes a check-in, an "Unhappy" opens a call-back). Answers the task
 * after, or null for an outcome that writes nothing.
 */
export function useTaskOutcome(
  options: CrudMutationOptions<TaskRecord | null, TaskOutcomeInput> = {},
) {
  const organizationId = useOrganizationId();
  const refreshAfterRules = useRefreshTasksAfterRules();
  return useAppMutation<TaskRecord | null, TaskOutcomeInput, unknown, TaskRow>({
    mutationFn: (input, action) => recordTaskOutcome({ ...input, ...action }),
    invalidateKeys: TASK_WRITE_KEYS,
    optimisticInfinite: {
      queryKey: taskQueryKeys.lists(organizationId),
      update: (rows, { task, outcomeId }) =>
        findTaskOutcome(task.type, outcomeId)?.write.type === 'none'
          ? rows
          : withoutTask(rows, task.id),
    },
    ...options,
    onSuccess: async (record, input) => {
      refreshAfterRules();
      await options.onSuccess?.(record, input);
    },
  });
}

/**
 * What a snooze sends: the task, the option, when it was chosen, its branch's hours and the words
 * its row shows.
 */
export interface TaskSnoozeVars {
  taskId: string;
  option: TaskSnoozeOption;
  /** When the member chose it (an instant) — the wake time counts from here, so a retry sends the same. */
  now: string;
  /** The task's branch's hours — "Tomorrow" wakes it at the branch's next opening. */
  hours: BranchHours;
  /** The option's words ("1 hour") — the row's "Snoozed · <label>". */
  label: string | null;
}

/** Snooze a task with one of the drawer's options; it leaves To do at once and comes back if the write fails. */
export function useSnoozeTask(
  options: CrudMutationOptions<TaskRecord, TaskSnoozeVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<TaskRecord, TaskSnoozeVars, unknown, TaskRow>({
    mutationFn: ({ taskId, option, now, hours, label }, action) =>
      snoozeTask({
        taskId,
        until: taskSnoozeUntil(option, now, hours),
        label,
        ...action,
      }),
    invalidateKeys: [taskQueryKeys.all],
    optimisticInfinite: {
      queryKey: taskQueryKeys.lists(organizationId),
      update: (rows, { taskId }) => withoutTask(rows, taskId),
    },
    ...options,
  });
}

/** What a reassign sends: the task and who it goes to. */
export interface TaskReassignVars {
  taskId: string;
  assignee: TaskAssignee;
}

/**
 * Move a task to a member or a role's queue — a lead's task moves its lead too (and needs
 * `lead:update`, `taskReassignCodes`).
 */
export function useReassignTask(
  options: CrudMutationOptions<TaskRecord, TaskReassignVars> = {},
) {
  return useAppMutation<TaskRecord, TaskReassignVars>({
    mutationFn: (vars, action) => reassignTask({ ...vars, ...action }),
    invalidateKeys: TASK_WRITE_KEYS,
    ...options,
  });
}

/** What a create sends: New task's or "What’s next"'s fields. */
export interface TaskCreateVars {
  fields: TaskFields;
}

/** Create a task by hand — New task or "What’s next"; not optimistic. */
export function useCreateTask(
  options: CrudMutationOptions<TaskRecord, TaskCreateVars> = {},
) {
  return useAppMutation<TaskRecord, TaskCreateVars>({
    mutationFn: (vars, action) => addTask({ ...vars, ...action }),
    invalidateKeys: [taskQueryKeys.all],
    ...options,
  });
}

/** What a delete sends: the task and the reason ("mistake" for a New task's Undo). */
export interface TaskDeleteVars {
  taskId: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a task made by hand (`task:delete`) — optimistic: the row leaves every list at once and
 * comes back if the write fails. The lists refresh, not the task's own read (a 404 now).
 */
export function useDeleteTask(options: CrudMutationOptions<void, TaskDeleteVars> = {}) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, TaskDeleteVars, unknown, TaskRow>({
    mutationFn: (vars) => deleteTask(vars),
    invalidateKeys: [taskQueryKeys.lists(organizationId)],
    optimisticInfinite: {
      queryKey: taskQueryKeys.lists(organizationId),
      update: (rows, { taskId }) => withoutTask(rows, taskId),
    },
    ...options,
  });
}

/** Bring a deleted task back — the Undo of its "removed" toast. */
export function useRestoreTask(options: CrudMutationOptions<TaskRecord, string> = {}) {
  return useAppMutation<TaskRecord, string>({
    mutationFn: (taskId, action) => restoreTask(taskId, action.idempotencyKey),
    invalidateKeys: [taskQueryKeys.all],
    ...options,
  });
}

/**
 * Switch rules or hand them to Clinozy (`organization:update`): the switches move at once and roll
 * back if the save fails; the lists refresh, since an off rule's tasks leave every view.
 */
export function useSaveTaskRuleSettings() {
  const organizationId = useOrganizationId();
  return useAppMutation<
    TaskRuleSettings,
    readonly TaskRuleSettingChange[],
    TaskRuleSettings
  >({
    mutationFn: (changes, action) => saveTaskRuleSettings({ changes, ...action }),
    invalidateKeys: [taskQueryKeys.all],
    toastId: 'task-rule-settings',
    optimistic: {
      queryKey: taskQueryKeys.ruleSettings(organizationId),
      update: (previous, changes) => {
        if (!previous) return previous;
        const next: TaskRuleSettings = { ...previous };
        for (const { ruleKey, ...patch } of changes) {
          const setting = previous[ruleKey];
          if (setting) next[ruleKey] = { ...setting, ...patch };
        }
        return next;
      },
    },
  });
}
