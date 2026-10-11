import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Packages
 * (`/organization/$organizationSlug/patients/$patientId/packages`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `app-patients`
 * module, the org status); in-room access is `useAppAccess`.
 */
export const manifest = {
  segment: 'packages',
  path: '/organization/$organizationSlug/patients/$patientId/packages',
  title: 'Packages',
  testId: 'patient-section-packages',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
