import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit offer — a URL-driven dialog over the Offers tab
 * (`/organization/$organizationSlug/offerings/offers/$offerId/edit`, `S:103`;
 * KICKOFF §4, D24). The route renders nothing: the Offers page reads the URL
 * and opens the offer's drawer — editable with Offerings Edit and the `prices`
 * ability, view only without. The `$offerId` segment has no page of its own.
 * The test id names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/offerings/offers/$offerId/edit',
  title: 'Edit offer',
  testId: 'offer-drawer',
  permission: 'organization:read',
  module: 'clinic-offerings',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
