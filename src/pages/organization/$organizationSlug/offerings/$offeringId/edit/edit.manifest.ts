import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit offering — a URL-driven dialog over the Offerings tab
 * (`/organization/$organizationSlug/offerings/$offeringId/edit`, `S:100`;
 * KICKOFF §4, D24). The route renders nothing: the Offerings page reads the
 * URL and opens the offering's drawer — editable with Offerings Edit, view
 * only without it. Same gates as the room. The `$offeringId` segment has no
 * page of its own. The test id names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/offerings/$offeringId/edit',
  title: 'Edit offering',
  testId: 'offering-drawer',
  permission: 'organization:read',
  module: 'clinic-offerings',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
