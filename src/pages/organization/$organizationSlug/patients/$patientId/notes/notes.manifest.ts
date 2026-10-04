import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Team notes
 * (`/organization/$organizationSlug/patients/$patientId/notes`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'notes',
  path: '/organization/$organizationSlug/patients/$patientId/notes',
  title: 'Team notes',
  testId: 'patient-section-notes',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
