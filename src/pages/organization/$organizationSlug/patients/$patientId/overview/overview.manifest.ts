import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Clinical notes
 * (`/organization/$organizationSlug/patients/$patientId/overview`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'overview',
  path: '/organization/$organizationSlug/patients/$patientId/overview',
  title: 'Clinical notes',
  testId: 'patient-section-overview',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
