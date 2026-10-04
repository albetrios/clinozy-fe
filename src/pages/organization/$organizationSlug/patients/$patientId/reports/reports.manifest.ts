import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Reports
 * (`/organization/$organizationSlug/patients/$patientId/reports`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'reports',
  path: '/organization/$organizationSlug/patients/$patientId/reports',
  title: 'Reports',
  testId: 'patient-section-reports',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
