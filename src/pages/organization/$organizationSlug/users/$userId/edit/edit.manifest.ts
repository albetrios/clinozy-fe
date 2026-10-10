import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit user — the member drawer, a URL-driven dialog over the Team
 * (`/organization/$organizationSlug/users/$userId/edit`, `S:106`; KICKOFF §4,
 * D24). `$userId` carries the membership id: clinozy-be keys every member write
 * by membership (AMBER). The route renders nothing: the Users page reads the URL
 * and opens the drawer; an id the Team doesn't have lands back on the Team with
 * "User not found". Same gates as the room; writes need `membership:update`.
 * The test id names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/users/$userId/edit',
  title: 'Edit user',
  testId: 'user-drawer',
  permission: 'membership:read',
  module: 'clinic-users',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
