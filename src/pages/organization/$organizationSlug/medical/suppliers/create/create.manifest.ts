import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New supplier — a URL-driven dialog over Medical › Suppliers
 * (`/organization/$organizationSlug/medical/suppliers/create`; KICKOFF §4, D24): New supplier (`S:62`). The route renders nothing: the
 * Suppliers page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/medical/suppliers/create',
  title: 'New supplier',
  testId: 'supplier-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
