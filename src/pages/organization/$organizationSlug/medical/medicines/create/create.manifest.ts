import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New medicine — a URL-driven dialog over Medical › Medicines
 * (`/organization/$organizationSlug/medical/medicines/create`; KICKOFF §4, D24): New medicine (`S:54`), its name prefilled from `?name=`. The route renders nothing: the
 * Medicines page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/medical/medicines/create',
  title: 'New medicine',
  testId: 'medicine-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
