import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * An invoice's preview with Print — a URL-driven dialog over its referrer
 * (`/organization/$organizationSlug/invoices/$invoiceId`, `S:93`; KICKOFF §4,
 * D24). The route renders nothing: the invoices island reads the URL and opens
 * the preview. Its child is the invoice's edit. The test id names that preview.
 */
export const manifest = {
  segment: '$invoiceId',
  path: '/organization/$organizationSlug/invoices/$invoiceId',
  title: 'Invoice',
  testId: 'invoice-preview',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'layout',
  children: ['edit'],
} as const satisfies PageManifest;
