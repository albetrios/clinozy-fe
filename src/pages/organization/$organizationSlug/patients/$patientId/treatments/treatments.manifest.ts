import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Treatments
 * (`/organization/$organizationSlug/patients/$patientId/treatments`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `app-patients`
 * module, the org status); in-room access is `useAppAccess`.
 */
export const manifest = {
  segment: 'treatments',
  path: '/organization/$organizationSlug/patients/$patientId/treatments',
  title: 'Treatments',
  testId: 'patient-section-treatments',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'layout',
  children: ['create', '$treatmentId'],
} as const satisfies PageManifest;
