import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Suspended — leaf island (`/organization/$organizationSlug/suspended`).
 * Blocked state for suspended / lapsed organizations; target of
 * `requireActiveOrganization`.
 */
export const manifest = {
  segment: 'suspended',
  path: '/organization/$organizationSlug/suspended',
  title: 'Organization suspended',
  testId: 'suspended-page',
  permission: null,
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
