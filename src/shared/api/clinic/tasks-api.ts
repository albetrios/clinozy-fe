import type { ListPage } from '@/shared/api/fetch-list-page.ts';

import {
  type CreateTaskInput,
  type ReassignTaskInput,
  type RecordTaskOutcomeInput,
  type SaveTaskRuleSettingInput,
  type SnoozeTaskInput,
  TASK_SEARCH_MAX,
  type TaskChange,
  type TaskDetail,
  type TaskListQuery,
  type TaskListQueryInput,
  taskListQuerySchema,
  type TaskRow,
  type TaskRuleSettings,
} from './tasks-contracts.ts';

/**
 * The Tasks API (KICKOFF §6.10; `schema-routes.md` S:1718–1729 plus Appendix
 * F). REPLACE_WITH_API: every call runs on the fixture server, loaded on
 * demand so the seed data never lands in a room's chunk; when clinozy-be
 * serves tasks, these bodies become `apiClient` calls and nothing else moves.
 */

const server = () => import('./fixtures/tasks-server.fixtures.ts');

/**
 * A list query with its defaults filled, the search trimmed to its limit and
 * the rule filter in a stable order — so equal queries share one cache entry.
 */
export function normalizeTaskListQuery(query: TaskListQueryInput = {}): TaskListQuery {
  const parsed = taskListQuerySchema.parse({
    ...query,
    q: query.q?.trim().slice(0, TASK_SEARCH_MAX),
  });
  return { ...parsed, type: [...new Set(parsed.type)].sort() };
}

/** TanStack Query keys for tasks. */
export const taskQueryKeys = {
  all: ['clinic', 'tasks'] as const,
  lists: () => [...taskQueryKeys.all, 'list'] as const,
  list: (query: TaskListQueryInput = {}) =>
    [...taskQueryKeys.lists(), normalizeTaskListQuery(query)] as const,
  details: () => [...taskQueryKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...taskQueryKeys.details(), taskId] as const,
  ruleSettings: () => [...taskQueryKeys.all, 'rule-settings'] as const,
};

/**
 * The other records a task write can change — leads, their messages (the chat
 * column's threads, `messageQueryKeys`) and contact threads, appointments,
 * patients, check-ins — by the `['clinic', <domain>]` key prefix each room
 * keeps its queries under.
 */
export const TASK_SIDE_EFFECT_KEYS = [
  ['clinic', 'leads'],
  ['clinic', 'messages'],
  ['clinic', 'contact-threads'],
  ['clinic', 'appointments'],
  ['clinic', 'patients'],
  ['clinic', 'check-ins'],
] as const;

/** One page of the list (`listTasks`), from `after` — the previous page's cursor. */
export async function fetchTaskPage(
  query: TaskListQueryInput,
  after?: string,
): Promise<ListPage<TaskRow>> {
  return (await server()).listTasks(normalizeTaskListQuery(query), after);
}

/** The drawer's read (`getTask`): the task, its source record, the person's thread. */
export async function fetchTask(taskId: string): Promise<TaskDetail> {
  return (await server()).getTask(taskId);
}

/** Record one of the task's outcomes (`resolveTask`): its effects, then close or snooze. */
export async function recordTaskOutcome(
  input: RecordTaskOutcomeInput,
): Promise<TaskChange> {
  return (await server()).recordTaskOutcome(input);
}

/** Snooze a task with one of the drawer's options. */
export async function snoozeTask(input: SnoozeTaskInput): Promise<TaskChange> {
  return (await server()).snoozeTask(input);
}

/** Move a task (and a lead task's lead) to someone else; the previous owner stays involved. */
export async function reassignTask(input: ReassignTaskInput): Promise<TaskChange> {
  return (await server()).reassignTask(input);
}

/** Create a task (`createTask`): a "What’s next" follow-up or a New task. */
export async function createTask(input: CreateTaskInput): Promise<TaskChange> {
  return (await server()).createTask(input);
}

/** "Let Clinozy do it": resolved by Clinozy with the rule's automation. */
export async function handTaskToClinozy(taskId: string): Promise<TaskChange> {
  return (await server()).handTaskToClinozy(taskId);
}

/** Undo a task write with the token it answered — side effects included. */
export async function undoTaskChange(undoToken: string): Promise<void> {
  return (await server()).undoTaskChange(undoToken);
}

/** Every rule's org setting: on, and handed to Clinozy. */
export async function fetchTaskRuleSettings(): Promise<TaskRuleSettings> {
  return (await server()).getTaskRuleSettings();
}

/** Change one rule's setting; answers every rule's. */
export async function saveTaskRuleSetting(
  input: SaveTaskRuleSettingInput,
): Promise<TaskRuleSettings> {
  return (await server()).saveTaskRuleSetting(input);
}
