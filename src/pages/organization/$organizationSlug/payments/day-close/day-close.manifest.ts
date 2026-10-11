import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Day close — a URL-driven dialog over the Payments ledger
 * (`/organization/$organizationSlug/payments/day-close`, `S:91`; KICKOFF §4, D24).
 * The route renders nothing: the Payments ledger reads the URL and opens the drawer.
 * Same gates as the room; in-room access is `useAppAccess`. The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'day-close',
  path: '/organization/$organizationSlug/payments/day-close',
  title: 'Day close',
  testId: 'day-close-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
