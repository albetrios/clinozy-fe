import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Clinic stock › Purchases (`/organization/$organizationSlug/stock/purchases`; KICKOFF §4, D24) —
 * the bills from clinic vendors — what each brought in, its bill and what is still due — and the New / Edit purchase dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'purchases',
  path: '/organization/$organizationSlug/stock/purchases',
  title: 'Clinic stock',
  testId: 'stock-purchases-page',
  permission: 'organization:read',
  module: 'app-stock',
  kind: 'layout',
  children: ['create', '$purchaseId/edit'],
} as const satisfies PageManifest;
