import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The photo viewer
 * (`/organization/$organizationSlug/patients/$patientId/images/$imageId`,
 * `S:40`; KICKOFF §6.6) — a full-screen dialog over Photos. The file layout's
 * gate covers it; the Private album needs `patient:private_album:read`. Its child
 * on disk is Photo details (`edit`), which `routeTree.tsx` registers beside it
 * under Photos.
 */
export const manifest = {
  segment: '$imageId',
  path: '/organization/$organizationSlug/patients/$patientId/images/$imageId',
  title: 'Photo',
  testId: 'patient-photo-viewer',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'layout',
  children: ['edit'],
} as const satisfies PageManifest;
