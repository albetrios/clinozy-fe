import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Tasks room island manifest (`/organization/$organizationSlug/tasks`) —
 * Follow-ups, feedback calls, reminders, with an owner and due time (KICKOFF §6.10). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `tasks` section.
 */
export const manifest = {
  segment: 'tasks',
  path: '/organization/$organizationSlug/tasks',
  title: 'Tasks',
  testId: 'tasks-page',
  permission: 'organization:read',
  module: 'clinic-tasks',
  nav: { id: 'tasks', section: 'tasks' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
