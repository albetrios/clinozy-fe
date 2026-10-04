import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit manufacturer — a URL-driven dialog over Medical › Manufacturers
 * (`/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit`; KICKOFF §4, D24): Edit manufacturer (`S:66`). The route renders nothing: the
 * Manufacturers page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit',
  title: 'Edit manufacturer',
  testId: 'manufacturer-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
