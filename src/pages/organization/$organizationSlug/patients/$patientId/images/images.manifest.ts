import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Photos
 * (`/organization/$organizationSlug/patients/$patientId/images`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`. Its child is
 * the photo viewer (`$imageId`, with Photo details under it, `S:41–42`).
 */
export const manifest = {
  segment: 'images',
  path: '/organization/$organizationSlug/patients/$patientId/images',
  title: 'Photos',
  testId: 'patient-section-images',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'layout',
  children: ['$imageId'],
} as const satisfies PageManifest;
