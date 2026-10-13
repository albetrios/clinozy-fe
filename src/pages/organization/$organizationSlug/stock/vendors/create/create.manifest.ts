import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New clinic vendor — a URL-driven dialog over Clinic stock › Vendors
 * (`/organization/$organizationSlug/stock/vendors/create`; KICKOFF §4, D24): New clinic vendor (`S:82`): a name and a mobile. The route renders nothing: the
 * Vendors page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/stock/vendors/create',
  title: 'New clinic vendor',
  testId: 'stock-vendor-drawer',
  permission: 'organization:read',
  module: 'app-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
