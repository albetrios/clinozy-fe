import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Receive payment — a URL-driven dialog over the Payments ledger
 * (`/organization/$organizationSlug/payments/receive`, `S:85`; KICKOFF §4, D24).
 * The route renders nothing: the Payments ledger reads the URL and opens the drawer.
 * Same gates as the room; in-room access is `useAppAccess`. The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'receive',
  path: '/organization/$organizationSlug/payments/receive',
  title: 'Receive payment',
  testId: 'receive-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
