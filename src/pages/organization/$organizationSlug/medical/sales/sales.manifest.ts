import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Sales (`/organization/$organizationSlug/medical/sales`) — the
 * room's first tab, where `/medical` lands. Same gates as the room.
 */
export const manifest = {
  segment: 'sales',
  path: '/organization/$organizationSlug/medical/sales',
  title: 'Medical',
  testId: 'medical-sales-page',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
