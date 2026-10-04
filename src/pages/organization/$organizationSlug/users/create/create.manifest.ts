import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New user — a URL-driven dialog over the Team
 * (`/organization/$organizationSlug/users/create`, `S:105`; KICKOFF §4, D24).
 * The route renders nothing: the Team page reads the URL and opens the user
 * drawer, which sends an invitation (D17). Same gates as the room; "New user"
 * itself needs `invitation:manage` and `membership:manage` (D47) — without
 * them the link lands back on the Team with the permission toast. The test id
 * names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/users/create',
  title: 'New user',
  testId: 'user-drawer',
  permission: 'membership:read',
  module: 'clinic-users',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
