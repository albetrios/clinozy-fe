import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Send payment — a URL-driven dialog over the Payments ledger
 * (`/organization/$organizationSlug/payments/pay`, `S:86`; KICKOFF §4, D24).
 * The route renders nothing: the Payments ledger reads the URL and opens the drawer.
 * Same gates as the room; in-room access is `useAppAccess`. The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'pay',
  path: '/organization/$organizationSlug/payments/pay',
  title: 'Send payment',
  testId: 'pay-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
