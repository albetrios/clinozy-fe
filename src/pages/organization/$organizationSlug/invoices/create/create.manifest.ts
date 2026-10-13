import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New invoice — a URL-driven dialog over its referrer
 * (`/organization/$organizationSlug/invoices/create`, `S:92`; KICKOFF §4, D24):
 * `?type=clinic|consultation|medical&patient=` prefill it, `from` keeps the
 * room that opened it. The route renders nothing: the invoices island reads
 * the URL and opens the drawer. Same gates as the island; Create in Payments
 * is checked in-room. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/invoices/create',
  title: 'New invoice',
  testId: 'invoice-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
