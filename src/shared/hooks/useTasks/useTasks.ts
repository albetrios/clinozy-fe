import {
  createTask,
  fetchTask,
  fetchTaskPage,
  fetchTaskRuleSettings,
  handTaskToClinozy,
  normalizeTaskListQuery,
  reassignTask,
  recordTaskOutcome,
  saveTaskRuleSetting,
  snoozeTask,
  TASK_SIDE_EFFECT_KEYS,
  taskQueryKeys,
  undoTaskChange,
} from '@/shared/api/clinic/tasks-api.ts';
import {
  type CreateTaskInput,
  findTaskOutcome,
  type ReassignTaskInput,
  type RecordTaskOutcomeInput,
  type SaveTaskRuleSettingInput,
  type SnoozeTaskInput,
  type TaskChange,
  type TaskListQueryInput,
  type TaskRow,
  type TaskRuleSettings,
  TASKS_REFETCH_MS,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import {
  type CursorListResult,
  useCursorList,
} from '@/shared/hooks/useCursorList/index.ts';

/**
 * Tasks' server state (KICKOFF §6.10, one model with Today's aside, Q-T3): the
 * list and the drawer poll every 60s; every write refetches the lists, the
 * drawer and the records it may have changed. Writes toast only their errors
 * — the rooms toast success themselves, each with its Undo.
 */

/** What every task write may have changed. */
const TASK_WRITE_KEYS = [taskQueryKeys.all, ...TASK_SIDE_EFFECT_KEYS];

/** Options for {@link useTaskList} and {@link useTask}. */
export interface TaskQueryOptions {
  enabled?: boolean;
  /** Toast a failed load (default: true); off when the room shows its own "Couldn’t load" toast. */
  notifyOnError?: boolean;
}

/** One view of the list — To do, Snoozed or Done — scoped, filtered, searched, 50 a page, polled. */
export function useTaskList(
  query: TaskListQueryInput,
  options: TaskQueryOptions = {},
): CursorListResult<TaskRow> {
  const normalized = normalizeTaskListQuery(query);
  return useCursorList({
    queryKey: taskQueryKeys.list(normalized),
    queryFn: (after) => fetchTaskPage(normalized, after),
    refetchInterval: TASKS_REFETCH_MS,
    ...options,
  });
}

/** The drawer's task: the row, its source record, the person's thread and its messages. */
export function useTask(
  taskId: string | null | undefined,
  options: TaskQueryOptions = {},
) {
  return useAppQuery({
    queryKey: taskQueryKeys.detail(taskId ?? ''),
    queryFn: () => fetchTask(taskId ?? ''),
    enabled: Boolean(taskId) && (options.enabled ?? true),
    refetchInterval: TASKS_REFETCH_MS,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** The rows without one task — it left its view (closed, snoozed, handed to Clinozy). */
const withoutTask = (rows: TaskRow[], taskId: string): TaskRow[] =>
  rows.filter((row) => row.id !== taskId);

/**
 * Close, snooze or act on a task with one of its rule's outcomes — the one
 * write Tasks and Today's aside share. The row leaves the list at once and
 * comes back if the write fails.
 */
export function useTaskOutcome() {
  return useAppMutation<TaskChange, RecordTaskOutcomeInput, unknown, TaskRow>({
    mutationFn: recordTaskOutcome,
    invalidateKeys: TASK_WRITE_KEYS,
    optimisticInfinite: {
      queryKey: taskQueryKeys.lists(),
      // A closing or snoozing outcome takes the row out; "Claim it" and "Fix
      // the number" leave it for the rules and the refetch.
      update: (rows, input) =>
        rows.filter(
          (row) =>
            row.id !== input.taskId ||
            findTaskOutcome(row.rule, input.outcome)?.disposition.type === 'none',
        ),
    },
  });
}

/** Snooze a task with one of the drawer's options; it leaves To do at once. */
export function useSnoozeTask() {
  return useAppMutation<TaskChange, SnoozeTaskInput, unknown, TaskRow>({
    mutationFn: snoozeTask,
    invalidateKeys: TASK_WRITE_KEYS,
    optimisticInfinite: {
      queryKey: taskQueryKeys.lists(),
      update: (rows, input) => withoutTask(rows, input.taskId),
    },
  });
}

/** Move a task (and a lead task's lead) to someone else; the previous owner stays involved. */
export function useReassignTask() {
  return useAppMutation<TaskChange, ReassignTaskInput>({
    mutationFn: reassignTask,
    invalidateKeys: TASK_WRITE_KEYS,
  });
}

/** Options for {@link useCreateTask}. */
export interface CreateTaskOptions {
  /** Toast a failed create (default: true); off when the drawer raises its own. */
  notifyOnError?: boolean;
}

/** Create a task — "What’s next" or New task. */
export function useCreateTask(options: CreateTaskOptions = {}) {
  return useAppMutation<TaskChange, CreateTaskInput>({
    mutationFn: createTask,
    invalidateKeys: TASK_WRITE_KEYS,
    notifyOnError: options.notifyOnError ?? true,
  });
}

/** "Let Clinozy do it": the task resolves by Clinozy and leaves the list at once. */
export function useHandTaskToClinozy() {
  return useAppMutation<TaskChange, string, unknown, TaskRow>({
    mutationFn: handTaskToClinozy,
    invalidateKeys: TASK_WRITE_KEYS,
    optimisticInfinite: {
      queryKey: taskQueryKeys.lists(),
      update: (rows, taskId) => withoutTask(rows, taskId),
    },
  });
}

/** Undo a task write by the token it answered — the toasts' "Undo". */
export function useUndoTaskChange() {
  return useAppMutation<void, string>({
    mutationFn: undoTaskChange,
    invalidateKeys: TASK_WRITE_KEYS,
  });
}

/** Every rule's org setting — on, and handed to Clinozy (the Rules popover). */
export function useTaskRuleSettings() {
  return useAppQuery({
    queryKey: taskQueryKeys.ruleSettings(),
    queryFn: fetchTaskRuleSettings,
    staleTime: 5 * 60_000,
  });
}

/**
 * Switch a rule or hand it to Clinozy: the switch moves at once and rolls
 * back if the save fails; the lists refetch, since an off rule's tasks drop
 * out of every view.
 */
export function useSaveTaskRuleSetting() {
  return useAppMutation<TaskRuleSettings, SaveTaskRuleSettingInput, TaskRuleSettings>({
    mutationFn: saveTaskRuleSetting,
    invalidateKeys: [taskQueryKeys.ruleSettings(), taskQueryKeys.lists()],
    toastId: 'task-rule-settings',
    optimistic: {
      queryKey: taskQueryKeys.ruleSettings(),
      update: (previous, { rule, ...patch }) =>
        previous ? { ...previous, [rule]: { ...previous[rule], ...patch } } : previous,
    },
  });
}
