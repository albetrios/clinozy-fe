import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Clinic stock › Items (`/organization/$organizationSlug/stock/items`) — the
 * room's first tab, where `/stock` lands. Same gates as the room.
 */
export const manifest = {
  segment: 'items',
  path: '/organization/$organizationSlug/stock/items',
  title: 'Clinic stock',
  testId: 'stock-items-page',
  permission: 'organization:read',
  module: 'clinic-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
