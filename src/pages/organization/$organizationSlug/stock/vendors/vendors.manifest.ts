import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Clinic stock › Vendors (`/organization/$organizationSlug/stock/vendors`; KICKOFF §4, D24) —
 * the clinic's vendors (Q-K1) — their purchases and what they are owed — and the New / Edit clinic vendor dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'vendors',
  path: '/organization/$organizationSlug/stock/vendors',
  title: 'Clinic stock',
  testId: 'stock-vendors-page',
  permission: 'organization:read',
  module: 'clinic-stock',
  kind: 'layout',
  children: ['create', '$vendorId/edit'],
} as const satisfies PageManifest;
