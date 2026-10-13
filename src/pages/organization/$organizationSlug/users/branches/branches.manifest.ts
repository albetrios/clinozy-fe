import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Users › Branches (`/organization/$organizationSlug/users/branches`, `S:108`;
 * KICKOFF §6.12) — the room's third tab: every branch, open and closed, and
 * the branch drawer. Registered beside the Team rather than under it, because
 * the Team route renders the Team. Opens with `branch:read` (and the
 * `app-users` module); creating a branch needs `branch:create`, editing —
 * closing one included, a branch is never deleted — `branch:update`. Its children: New
 * branch (`create`) and the branch drawer (`$branchId/edit`) — URL-driven
 * dialogs over the list (D24, `S:109–110`).
 */
export const manifest = {
  segment: 'branches',
  path: '/organization/$organizationSlug/users/branches',
  title: 'Branches',
  testId: 'users-branches-page',
  permission: 'branch:read',
  module: 'app-users',
  kind: 'layout',
  children: ['create', '$branchId'],
} as const satisfies PageManifest;
