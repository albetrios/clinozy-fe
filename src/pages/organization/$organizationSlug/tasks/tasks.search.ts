/**
 * URL search-param schemas for the Tasks room (consumed by routeTree's
 * `validateSearch`): the list's view, search, rule filter and scope (KICKOFF
 * §6.10, `S:95`). A value the URL can't hold — an unknown view, a rule the
 * type filter does not offer — is dropped, never an error. Defaults stay out
 * of the URL (`/tasks` is To do, Mine).
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the tasks contract module is pages of zod. The test pins
 * each list to the contract's.
 */
import { listOf, oneOf, queryOf } from '@/lib/routes/search-params.ts';
import type {
  TaskListQuery,
  TaskRuleId,
  TaskScope,
  TaskTab,
} from '@/shared/api/clinic/tasks-contracts.ts';

/** The views, "To do · Snoozed · Done" — `queue` is the contract's "Queue" (S:95, D22). */
export const TASK_VIEWS = [
  'queue',
  'snoozed',
  'done',
] as const satisfies readonly TaskTab[];

/** "Mine" (mine and unowned) · "Everyone". */
export const TASK_SCOPE_VALUES = [
  'mine',
  'everyone',
] as const satisfies readonly TaskScope[];

/** The rules the type filter offers — the 13 designed ones, in its order (D42). */
export const TASK_TYPE_VALUES = [
  'reply',
  'follow',
  'claim',
  'failed',
  'confirm',
  'arrive',
  'rebook',
  'feedback',
  'aftercare',
  'unhappy',
  'nextvisit',
  'noreply',
  'manual',
] as const satisfies readonly TaskRuleId[];

/** The search field's limit (`tasks.md:66`). */
const SEARCH_MAX = 80;

/** Validated `?…` search params for `/tasks` and its dialog routes. */
export interface TasksSearch {
  /** To do (default) · Snoozed · Done. */
  tab?: TaskTab;
  /** Task title, person or why line (≤ 80 characters). */
  q?: string;
  /** Any of these rules. */
  type?: TaskRuleId[];
  /** Mine (default) · Everyone. */
  scope?: TaskScope;
}

/** The list's state when the URL says nothing. */
export const TASKS_SEARCH_DEFAULTS = {
  tab: 'queue',
  scope: 'mine',
} as const satisfies TasksSearch;

/**
 * Parse `/tasks` search params. Every key is answered, `undefined` included:
 * the router keeps a raw value the schema omits, so dropping one means saying so.
 */
export function validateTasksSearch(search: Record<string, unknown>): TasksSearch {
  return {
    tab: oneOf(TASK_VIEWS, search.tab),
    q: queryOf(search.q, SEARCH_MAX),
    type: listOf(search.type, (entry) => oneOf(TASK_TYPE_VALUES, entry) !== undefined),
    scope: oneOf(TASK_SCOPE_VALUES, search.scope),
  };
}

/** The list read's query for the URL as it stands — what the room hands `useTaskList`. */
export function taskListQueryOf(search: TasksSearch): TaskListQuery {
  return {
    tab: search.tab ?? TASKS_SEARCH_DEFAULTS.tab,
    scope: search.scope ?? TASKS_SEARCH_DEFAULTS.scope,
    type: search.type ?? [],
    q: search.q ?? '',
  };
}
