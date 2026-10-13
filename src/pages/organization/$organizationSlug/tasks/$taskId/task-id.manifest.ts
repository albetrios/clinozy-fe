import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The task drawer — a URL-driven dialog over the Tasks list
 * (`/organization/$organizationSlug/tasks/$taskId`, `S:97`; KICKOFF §4, D24).
 * Show is edit: a task is closed, snoozed or reassigned from the drawer. The
 * route renders nothing: the list page reads the URL, resolves the task and
 * opens the drawer — or, for an unknown id, stays on the list with "Task not
 * found · it may have been deleted" (`S:115`). Same gates as the room. The
 * test id names that drawer.
 */
export const manifest = {
  segment: '$taskId',
  path: '/organization/$organizationSlug/tasks/$taskId',
  title: 'Task',
  testId: 'task-drawer',
  permission: 'organization:read',
  module: 'app-tasks',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
