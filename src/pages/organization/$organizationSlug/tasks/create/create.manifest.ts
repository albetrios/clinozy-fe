import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New task — a URL-driven dialog over the Tasks list
 * (`/organization/$organizationSlug/tasks/create`, `S:96`; KICKOFF §4, D24,
 * Q-T4). The route renders nothing: the list page reads the URL and opens the
 * New task drawer — "For" the lead or person `?lead=lead_…` / `?contact=con_…`
 * name, or whoever is picked in the drawer. Same gates as the room; in-room
 * Create is the member's `task:create` (`POST /app/tasks`). The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/tasks/create',
  title: 'New task',
  testId: 'new-task-drawer',
  permission: 'organization:read',
  module: 'clinic-tasks',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
