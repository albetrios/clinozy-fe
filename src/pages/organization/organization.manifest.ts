import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Organization picker — list island (`/organization`).
 * Lists the signed-in user's organizations; selecting one enters its home,
 * `/organization/$organizationSlug`. The `/` resolver redirects here when no
 * last-used organization is known, or the active workspace is personal (D44).
 */
export const manifest = {
  segment: 'organization',
  path: '/organization',
  title: 'Choose organization',
  testId: 'organization-page',
  permission: null,
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
