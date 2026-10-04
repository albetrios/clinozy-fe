import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Manufacturers (`/organization/$organizationSlug/medical/manufacturers`; KICKOFF §4, D24) —
 * the brands on the pack with their medicines, suppliers and MRs, and the New / Edit manufacturer dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'manufacturers',
  path: '/organization/$organizationSlug/medical/manufacturers',
  title: 'Medical',
  testId: 'medical-manufacturers-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'layout',
  children: ['create', '$manufacturerId/edit'],
} as const satisfies PageManifest;
