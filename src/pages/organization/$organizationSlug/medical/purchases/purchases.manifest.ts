import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Purchases (`/organization/$organizationSlug/medical/purchases`; KICKOFF §4, D24) —
 * purchase orders from Ordered to Received to Paid, and the order, view and Receive goods dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'purchases',
  path: '/organization/$organizationSlug/medical/purchases',
  title: 'Medical',
  testId: 'medical-purchases-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'layout',
  children: ['create', '$purchaseOrderId'],
} as const satisfies PageManifest;
