import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New MR — a URL-driven dialog over Medical › MRs
 * (`/organization/$organizationSlug/medical/mrs/create`; KICKOFF §4, D24): New MR (`S:68`). The route renders nothing: the
 * MRs page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/medical/mrs/create',
  title: 'New MR',
  testId: 'rep-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
