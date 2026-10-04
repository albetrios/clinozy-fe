import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Return from patient — a URL-driven dialog over Medical › Sales
 * (`/organization/$organizationSlug/medical/sales/$saleId/return`; KICKOFF §4, D24): Return from patient (`S:52`): what is coming back, the reason and the refund. The route renders nothing: the
 * Sales page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'return',
  path: '/organization/$organizationSlug/medical/sales/$saleId/return',
  title: 'Return from patient',
  testId: 'sale-return-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
