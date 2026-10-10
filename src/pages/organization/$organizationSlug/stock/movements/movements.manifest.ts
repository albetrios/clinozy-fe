import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Clinic stock › Movements (`/organization/$organizationSlug/stock/movements`; KICKOFF §4, D24) —
 * every stock change, newest first — uses, receipts, adjustments, damage, returns, opening stock and reverts. Same gates as the room.
 */
export const manifest = {
  segment: 'movements',
  path: '/organization/$organizationSlug/stock/movements',
  title: 'Clinic stock',
  testId: 'stock-movements-page',
  permission: 'organization:read',
  module: 'clinic-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
