import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New purchase — a URL-driven dialog over Clinic stock › Purchases
 * (`/organization/$organizationSlug/stock/purchases/create`; KICKOFF §4, D24): New purchase (`S:79`), with "Reorder low items" preset by `?reorder=low`. The route renders nothing: the
 * Purchases page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/stock/purchases/create',
  title: 'New purchase',
  testId: 'stock-purchase-drawer',
  permission: 'organization:read',
  module: 'clinic-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
