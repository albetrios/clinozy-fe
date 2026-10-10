/**
 * URL search-param schemas for the Tasks room (consumed by routeTree's
 * `validateSearch`): the list's view, search, type filter and scope (KICKOFF
 * §6.10, `S:95`). A value the URL can't hold — an unknown view, a type the
 * filter does not offer — is dropped, never an error; so is the old To do id
 * `queue` (now the API's `open`), which reads To do. Defaults stay out of the
 * URL (`/tasks` is To do, Mine).
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the tasks contract module is pages of zod. The test pins
 * each list to the contract's.
 */
import { listOf, oneOf, queryOf } from '@/lib/routes/search-params.ts';
import type {
  TaskScope,
  TaskTab,
  TaskType,
} from '@/shared/api/clinic/tasks-contracts.ts';

/** The views, "To do · Snoozed · Done" — To do is the API's `open` (route map §2 #21). */
export const TASK_VIEWS = [
  'open',
  'snoozed',
  'done',
] as const satisfies readonly TaskTab[];

/** "Mine" (mine and my roles' queues) · "Everyone". */
export const TASK_SCOPE_VALUES = [
  'mine',
  'everyone',
] as const satisfies readonly TaskScope[];

/**
 * The types the type filter offers — the API's rules and "Follow-ups you set"
 * (`by_hand`), in the Rules popover's order (the contract's `TASK_TYPE_VALUES`).
 */
export const TASK_TYPE_FILTER_VALUES = [
  'reply',
  'follow_up',
  'claim',
  'failed_message',
  'confirm',
  'arrive',
  'rebook',
  'feedback',
  'call_back',
  'aftercare',
  'next_visit',
  'gone_quiet',
  'by_hand',
  'payment_due',
  'settle_by',
  'medical_rep_visit',
] as const satisfies readonly TaskType[];

/** The search field's limit (`tasks.md:66`) — the list query's. */
const SEARCH_MAX = 80;

/** Validated `?…` search params for `/tasks` and its dialog routes. */
export interface TasksSearch {
  /** To do (default) · Snoozed · Done. */
  tab?: TaskTab;
  /** Task title, person or why line (≤ 80 characters). */
  q?: string;
  /** Any of these types. */
  type?: TaskType[];
  /** Mine (default) · Everyone. */
  scope?: TaskScope;
}

/** The list's state when the URL says nothing. */
export const TASKS_SEARCH_DEFAULTS = {
  tab: 'open',
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
    type: listOf(
      search.type,
      (entry) => oneOf(TASK_TYPE_FILTER_VALUES, entry) !== undefined,
    ),
    scope: oneOf(TASK_SCOPE_VALUES, search.scope),
  };
}
