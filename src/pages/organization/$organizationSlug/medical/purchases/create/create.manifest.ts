import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New purchase order — a URL-driven dialog over Medical › Purchases
 * (`/organization/$organizationSlug/medical/purchases/create`; KICKOFF §4, D24): New purchase order (`S:57`), prefilled from `?supplier=` or the "Reorder low stock" preset `?reorder=low`. The route renders nothing: the
 * Purchases page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/medical/purchases/create',
  title: 'New purchase order',
  testId: 'purchase-order-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
