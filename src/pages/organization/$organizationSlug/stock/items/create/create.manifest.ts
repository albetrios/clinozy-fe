import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New item — a URL-driven dialog over Clinic stock › Items
 * (`/organization/$organizationSlug/stock/items/create`; KICKOFF §4, D24): New item (`S:74`): a consumable or piece of equipment, its levels and its vendor. The route renders nothing: the
 * Items page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/stock/items/create',
  title: 'New item',
  testId: 'stock-item-drawer',
  permission: 'organization:read',
  module: 'clinic-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
