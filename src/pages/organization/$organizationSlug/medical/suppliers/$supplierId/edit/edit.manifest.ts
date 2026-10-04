import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit supplier — a URL-driven dialog over Medical › Suppliers
 * (`/organization/$organizationSlug/medical/suppliers/$supplierId/edit`; KICKOFF §4, D24): Edit supplier (`S:63`), with its Account. The route renders nothing: the
 * Suppliers page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/medical/suppliers/$supplierId/edit',
  title: 'Edit supplier',
  testId: 'supplier-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
