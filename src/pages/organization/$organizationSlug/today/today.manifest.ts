import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Today room island manifest (`/organization/$organizationSlug/today`) —
 * The clinic floor now: arrivals, waiting, with doctor, checkout (KICKOFF §6.2). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useAppAccess`. In the primary nav as the
 * `today` section.
 */
export const manifest = {
  segment: 'today',
  path: '/organization/$organizationSlug/today',
  title: 'Today',
  testId: 'today-page',
  permission: 'organization:read',
  module: 'app-today',
  nav: { id: 'today', section: 'today' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
