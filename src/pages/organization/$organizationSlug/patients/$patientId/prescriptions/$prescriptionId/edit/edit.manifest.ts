import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit prescription
 * (`/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId/edit`,
 * `S:37`; KICKOFF §6.6, D24) — Edit prescription — the Prescription drawer over Prescriptions.
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId/edit',
  title: 'Edit prescription',
  testId: 'rx-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
