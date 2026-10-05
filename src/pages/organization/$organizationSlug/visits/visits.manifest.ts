import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The Visit sheet's manifest (`/organization/$organizationSlug/visits/$visitId`;
 * KICKOFF §4, §6.13, D18) — a full-screen page of Today's module over the
 * shell. The route gates on membership and the Today module like the room
 * (D8, D9); which tabs show is each tab's own access (`canUseVisitTab`), and a
 * member with none is sent back to Today. Not a nav item.
 */
export const manifest = {
  segment: 'visits',
  path: '/organization/$organizationSlug/visits/$visitId',
  title: 'Visit',
  testId: 'visit-page',
  permission: 'organization:read',
  module: 'clinic-today',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
