import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit clinic vendor — a URL-driven dialog over Clinic stock › Vendors
 * (`/organization/$organizationSlug/stock/vendors/$vendorId/edit`; KICKOFF §4, D24): Edit clinic vendor (`S:83`) — a row's click. The route renders nothing: the
 * Vendors page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/stock/vendors/$vendorId/edit',
  title: 'Edit clinic vendor',
  testId: 'stock-vendor-drawer',
  permission: 'organization:read',
  module: 'clinic-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
