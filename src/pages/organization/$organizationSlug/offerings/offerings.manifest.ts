import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Offerings room island manifest (`/organization/$organizationSlug/offerings`) —
 * What the clinic sells: offerings, packages, offers and prices (KICKOFF §6.11). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `offerings` section.
 */
export const manifest = {
  segment: 'offerings',
  path: '/organization/$organizationSlug/offerings',
  title: 'Offerings',
  testId: 'offerings-page',
  permission: 'organization:read',
  module: 'clinic-offerings',
  nav: { id: 'offerings', section: 'offerings' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
