import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical room island manifest (`/organization/$organizationSlug/medical`) —
 * The medicine store: medicines for sale, suppliers, MRs, purchases, sales (KICKOFF §6.7). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `medical` section.
 */
export const manifest = {
  segment: 'medical',
  path: '/organization/$organizationSlug/medical',
  title: 'Medical',
  testId: 'medical-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  nav: { id: 'medical', section: 'medical' },
  kind: 'layout',
  children: [
    'sales',
    'medicines',
    'purchases',
    'suppliers',
    'manufacturers',
    'mrs',
    'payments',
  ],
} as const satisfies PageManifest;
