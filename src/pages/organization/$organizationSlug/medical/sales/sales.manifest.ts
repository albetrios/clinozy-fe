import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Sales (`/organization/$organizationSlug/medical/sales`; KICKOFF §4, D24) —
 * the room's first tab, where `/medical` lands (D25): every sale with its bill, margin and status, and the dialogs over it — New sale, the Sale, Return from patient. Same gates as the room.
 */
export const manifest = {
  segment: 'sales',
  path: '/organization/$organizationSlug/medical/sales',
  title: 'Medical',
  testId: 'medical-sales-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'layout',
  children: ['create', '$saleId'],
} as const satisfies PageManifest;
