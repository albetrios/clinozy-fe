import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit payment — a URL-driven dialog over the Payments ledger
 * (`/organization/$organizationSlug/payments/$paymentId/edit`, `S:87`; KICKOFF §4, D24).
 * The route renders nothing: the Payments ledger reads the URL and opens the drawer.
 * Same gates as the room; in-room access is `useAppAccess`. The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/payments/$paymentId/edit',
  title: 'Edit payment',
  testId: 'receive-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
