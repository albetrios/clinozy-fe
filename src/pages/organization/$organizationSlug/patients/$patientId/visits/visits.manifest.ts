import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Visits
 * (`/organization/$organizationSlug/patients/$patientId/visits`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `app-patients`
 * module, the org status); in-room access is `useAppAccess`.
 */
export const manifest = {
  segment: 'visits',
  path: '/organization/$organizationSlug/patients/$patientId/visits',
  title: 'Visits',
  testId: 'patient-section-visits',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
