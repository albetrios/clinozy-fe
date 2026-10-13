/**
 * The read the Tasks list makes from the page's URL and the header's branches
 * (KICKOFF §6.10). Kept out of `tasks.search.ts` on purpose — `routeTree.tsx`
 * (the entry chunk) imports that module for `validateSearch`, so anything else
 * exported from it that the room uses ships on the first paint; this module
 * loads with the room.
 */
import type { TaskListQuery } from '@/shared/api/app/tasks-contracts.ts';

import { TASKS_SEARCH_DEFAULTS, type TasksSearch } from './tasks.search.ts';

/**
 * The list read's query for the URL as it stands and the header's branch
 * filter (D32; none picked — every branch) — what the room hands `useTaskList`.
 */
export function taskListQueryOf(
  search: TasksSearch,
  branchIds: readonly string[] = [],
): TaskListQuery {
  return {
    tab: search.tab ?? TASKS_SEARCH_DEFAULTS.tab,
    scope: search.scope ?? TASKS_SEARCH_DEFAULTS.scope,
    type: search.type ?? [],
    q: search.q ?? '',
    ...(branchIds.length > 0 ? { branchIds: [...branchIds] } : {}),
  };
}
