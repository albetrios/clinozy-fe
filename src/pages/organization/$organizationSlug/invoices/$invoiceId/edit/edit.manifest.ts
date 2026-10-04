import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit invoice — a URL-driven dialog over its referrer
 * (`/organization/$organizationSlug/invoices/$invoiceId/edit`, `S:94`; KICKOFF
 * §4, D24). The route renders nothing: the invoices island reads the URL and
 * opens the drawer. Edit in Payments is checked in-room (view only without
 * it). The test id names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/invoices/$invoiceId/edit',
  title: 'Edit invoice',
  testId: 'invoice-drawer',
  permission: 'organization:read',
  module: 'clinic-payments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
