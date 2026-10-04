import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Treatments
 * (`/organization/$organizationSlug/patients/$patientId/treatments`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'treatments',
  path: '/organization/$organizationSlug/patients/$patientId/treatments',
  title: 'Treatments',
  testId: 'patient-section-treatments',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
