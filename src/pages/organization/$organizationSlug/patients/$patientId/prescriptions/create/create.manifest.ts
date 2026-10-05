import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New prescription
 * (`/organization/$organizationSlug/patients/$patientId/prescriptions/create`,
 * `S:35`; KICKOFF §6.6, D24) — New prescription — the 1040px Prescription drawer over Prescriptions.
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/patients/$patientId/prescriptions/create',
  title: 'New prescription',
  testId: 'rx-drawer',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
