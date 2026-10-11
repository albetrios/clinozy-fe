import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › MRs (`/organization/$organizationSlug/medical/mrs`; KICKOFF §4, D24) —
 * the medical representatives, their last and next visits, and the New / Edit MR and Log MR visit dialogs. Same gates as the room.
 */
export const manifest = {
  segment: 'mrs',
  path: '/organization/$organizationSlug/medical/mrs',
  title: 'Medical',
  testId: 'medical-mrs-page',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'layout',
  children: ['create', '$mrId/edit', '$mrId/visits/create'],
} as const satisfies PageManifest;
