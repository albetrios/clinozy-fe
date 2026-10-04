import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Medicines (`/organization/$organizationSlug/medical/medicines`; KICKOFF §4, D24) —
 * the store's medicines with their stock, nearest expiry, MRP and margin, and the New / Edit medicine dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'medicines',
  path: '/organization/$organizationSlug/medical/medicines',
  title: 'Medical',
  testId: 'medical-medicines-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'layout',
  children: ['create', '$medicineId/edit'],
} as const satisfies PageManifest;
