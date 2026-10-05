import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Prescription
 * (`/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId`,
 * `S:36`; KICKOFF §6.6, D24) — the prescription viewer — its print preview (820px, the shared A4 sheet, "Print / Save PDF") over Prescriptions.
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: '$prescriptionId',
  path: '/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId',
  title: 'Prescription',
  testId: 'rx-print-preview',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'layout',
  children: ['edit'],
} as const satisfies PageManifest;
