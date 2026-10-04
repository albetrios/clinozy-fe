import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit MR — a URL-driven dialog over Medical › MRs
 * (`/organization/$organizationSlug/medical/mrs/$mrId/edit`; KICKOFF §4, D24): Edit MR (`S:69`). The route renders nothing: the
 * MRs page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/medical/mrs/$mrId/edit',
  title: 'Edit MR',
  testId: 'mr-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
