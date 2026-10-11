import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Clinic stock › Items (`/organization/$organizationSlug/stock/items`; KICKOFF §4, D24) —
 * the room's first tab, where `/stock` lands: every consumable and piece of equipment with its stock, how long it lasts and who supplies it, and the dialogs over it — New / Edit item and Stock check. Same gates as the room.
 */
export const manifest = {
  segment: 'items',
  path: '/organization/$organizationSlug/stock/items',
  title: 'Clinic stock',
  testId: 'stock-items-page',
  permission: 'organization:read',
  module: 'app-stock',
  kind: 'layout',
  children: ['create', '$itemId/edit', 'check'],
} as const satisfies PageManifest;
