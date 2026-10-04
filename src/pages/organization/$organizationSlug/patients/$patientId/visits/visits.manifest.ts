import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Visits
 * (`/organization/$organizationSlug/patients/$patientId/visits`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'visits',
  path: '/organization/$organizationSlug/patients/$patientId/visits',
  title: 'Visits',
  testId: 'patient-section-visits',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
