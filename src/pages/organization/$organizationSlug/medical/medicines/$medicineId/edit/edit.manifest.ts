import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit medicine — a URL-driven dialog over Medical › Medicines
 * (`/organization/$organizationSlug/medical/medicines/$medicineId/edit`; KICKOFF §4, D24): Edit medicine (`S:55`) — a Medicines row click opens it. The route renders nothing: the
 * Medicines page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/medical/medicines/$medicineId/edit',
  title: 'Edit medicine',
  testId: 'medicine-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
