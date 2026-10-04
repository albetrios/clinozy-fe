import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Suppliers (`/organization/$organizationSlug/medical/suppliers`; KICKOFF §4, D24) —
 * the agencies the store buys from, what they are owed and for how long, and the New / Edit supplier dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'suppliers',
  path: '/organization/$organizationSlug/medical/suppliers',
  title: 'Medical',
  testId: 'medical-suppliers-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'layout',
  children: ['create', '$supplierId/edit'],
} as const satisfies PageManifest;
