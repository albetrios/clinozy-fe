import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Branches room island manifest (`/organization/$organizationSlug/branches`) —
 * every branch, open and closed, and the branch drawer (KICKOFF §6.12; `S:108`).
 * Once the Users room's third tab, its own room in the primary nav as the
 * `branches` section since change-branches-in-navbar — pinned by default.
 * Opens with `branch:read` (and the `app-branches` module); creating a branch
 * needs `branch:create`, editing — closing one included, a branch is never
 * deleted — `branch:update`. Its children: New branch (`create`) and the
 * branch drawer (`$branchId/edit`) — URL-driven dialogs over the list (D24,
 * `S:109–110`). The old `/users/branches…` URLs redirect here.
 */
export const manifest = {
  segment: 'branches',
  path: '/organization/$organizationSlug/branches',
  title: 'Branches',
  testId: 'branches-page',
  permission: 'branch:read',
  module: 'app-branches',
  nav: { id: 'branches', section: 'branches' },
  kind: 'layout',
  children: ['create', '$branchId'],
} as const satisfies PageManifest;
