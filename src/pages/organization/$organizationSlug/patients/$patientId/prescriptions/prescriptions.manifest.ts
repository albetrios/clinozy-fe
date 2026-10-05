import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Prescriptions
 * (`/organization/$organizationSlug/patients/$patientId/prescriptions`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'prescriptions',
  path: '/organization/$organizationSlug/patients/$patientId/prescriptions',
  title: 'Prescriptions',
  testId: 'patient-section-prescriptions',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'layout',
  children: ['create', '$prescriptionId'],
} as const satisfies PageManifest;
