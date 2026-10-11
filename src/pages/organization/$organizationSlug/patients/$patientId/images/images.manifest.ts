import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Photos
 * (`/organization/$organizationSlug/patients/$patientId/images`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `app-patients`
 * module, the org status); in-room access is `useAppAccess`. Its child is
 * the photo viewer (`$imageId`, with Photo details under it, `S:40–41`).
 */
export const manifest = {
  segment: 'images',
  path: '/organization/$organizationSlug/patients/$patientId/images',
  title: 'Photos',
  testId: 'patient-section-images',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'layout',
  children: ['$imageId'],
} as const satisfies PageManifest;
