import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Users › Roles & access (`/organization/$organizationSlug/users/roles`,
 * `S:107`; KICKOFF §6.12) — the room's second tab: each role, who holds it,
 * what it can see and do, its special permissions. Registered beside the Team
 * rather than under it, because the Team route renders the Team. Opens with
 * `role:read` (and the `app-users` module); changing a role needs
 * `role:update`, a new one `role:create`, a delete `role:delete` — checked in
 * the page.
 */
export const manifest = {
  segment: 'roles',
  path: '/organization/$organizationSlug/users/roles',
  title: 'Roles & access',
  testId: 'users-roles-page',
  permission: 'role:read',
  module: 'app-users',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
