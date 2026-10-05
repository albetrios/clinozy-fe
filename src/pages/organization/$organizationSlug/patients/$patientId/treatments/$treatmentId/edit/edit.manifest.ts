import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit treatment
 * (`/organization/$organizationSlug/patients/$patientId/treatments/$treatmentId/edit`,
 * `S:39`; KICKOFF §6.6, D24) — Edit treatment — the Treatment drawer over Treatments (show = edit).
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/patients/$patientId/treatments/$treatmentId/edit',
  title: 'Edit treatment',
  testId: 'treatment-drawer',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
