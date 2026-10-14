import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Credits (`/organization/$organizationSlug/medical/credits`; clinozy-be D90) — the
 * store's credits on both sides: from suppliers for returned stock, and with customers on its
 * sales. Same gates as the room; beyond the design, a standing deviation.
 */
export const manifest = {
  segment: 'credits',
  path: '/organization/$organizationSlug/medical/credits',
  title: 'Medical',
  testId: 'medical-credits-page',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
