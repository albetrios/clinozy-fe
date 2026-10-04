import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Users room island manifest (`/organization/$organizationSlug/users`) —
 * Team, roles & access, branches (KICKOFF §6.12). The bare URL is its first
 * tab, the Team. The route gates on `membership:read` and the clinic module
 * (D8, D17); in-room writes on the member's clinozy-be codes through
 * `useClinicAccess`. In the primary nav as the `users` section. Its children:
 * the invite drawer (`create`) and the member drawer (`$userId/edit`) — URL
 * driven dialogs over the Team (D24, `S:105–106`) — and Roles & access
 * (`roles`) and Branches (`branches`), registered beside the Team in the
 * route tree.
 */
export const manifest = {
  segment: 'users',
  path: '/organization/$organizationSlug/users',
  title: 'Users',
  testId: 'users-page',
  permission: 'membership:read',
  module: 'clinic-users',
  nav: { id: 'users', section: 'users' },
  kind: 'layout',
  children: ['create', '$userId', 'roles', 'branches'],
} as const satisfies PageManifest;
