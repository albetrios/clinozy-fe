import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit pending — a URL-driven dialog over Payments › Pending
 * (`/organization/$organizationSlug/payments/pending/$creditId/edit`, `S:90`; KICKOFF §4, D24).
 * The route renders nothing: the Pending page reads the URL and opens the drawer.
 * Same gates as the room; in-room access is `useAppAccess`. The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/payments/pending/$creditId/edit',
  title: 'Edit pending',
  testId: 'credit-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
