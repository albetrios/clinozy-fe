import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New manufacturer — a URL-driven dialog over Medical › Manufacturers
 * (`/organization/$organizationSlug/medical/manufacturers/create`; KICKOFF §4, D24): New manufacturer (`S:65`). The route renders nothing: the
 * Manufacturers page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/medical/manufacturers/create',
  title: 'New manufacturer',
  testId: 'manufacturer-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
