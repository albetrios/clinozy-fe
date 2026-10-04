import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New branch — a URL-driven dialog over Users › Branches
 * (`/organization/$organizationSlug/users/branches/create`, `S:109`; KICKOFF §4,
 * D24). The route renders nothing: the Branches page reads the URL and opens
 * the branch drawer. Same gates as the room; "New branch" itself follows the
 * matrix's Users row Create — without it the link lands back on the list with
 * the permission toast. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/users/branches/create',
  title: 'New branch',
  testId: 'branch-drawer',
  permission: 'membership:read',
  module: 'clinic-users',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
