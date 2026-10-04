import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Tasks room island manifest (`/organization/$organizationSlug/tasks`) —
 * Follow-ups, feedback calls, reminders, with an owner and due time (KICKOFF §6.10). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `tasks` section. Its children are URL-driven dialogs over the list — New
 * task (`create`, `S:96`, Q-T4) and the task drawer (`$taskId`, D24, `S:97`).
 */
export const manifest = {
  segment: 'tasks',
  path: '/organization/$organizationSlug/tasks',
  title: 'Tasks',
  testId: 'tasks-page',
  permission: 'organization:read',
  module: 'clinic-tasks',
  nav: { id: 'tasks', section: 'tasks' },
  kind: 'layout',
  children: ['create', '$taskId'],
} as const satisfies PageManifest;
