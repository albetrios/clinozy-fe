import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit branch — the branch drawer, a URL-driven dialog over Users › Branches
 * (`/organization/$organizationSlug/users/branches/$branchId/edit`, `S:110`;
 * KICKOFF §4, D24). The route renders nothing: the Branches page reads the URL
 * and opens the drawer; an id the list doesn't have lands back on Branches
 * with "Branch not found". Same gates as the tab; writes need `branch:update`.
 * The test id names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/users/branches/$branchId/edit',
  title: 'Edit branch',
  testId: 'branch-drawer',
  permission: 'branch:read',
  module: 'clinic-users',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
