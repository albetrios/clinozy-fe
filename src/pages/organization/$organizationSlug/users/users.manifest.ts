import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Users room island manifest (`/organization/$organizationSlug/users`) —
 * Team, roles & access, branches (KICKOFF §6.12). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `users` section.
 */
export const manifest = {
  segment: 'users',
  path: '/organization/$organizationSlug/users',
  title: 'Users',
  testId: 'users-page',
  permission: 'membership:read',
  module: 'clinic-users',
  nav: { id: 'users', section: 'users' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
