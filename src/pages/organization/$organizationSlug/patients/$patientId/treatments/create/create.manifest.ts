import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New treatment
 * (`/organization/$organizationSlug/patients/$patientId/treatments/create`,
 * `S:38`; KICKOFF §6.6, D24) — New treatment — the 680px Treatment drawer over Treatments.
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/patients/$patientId/treatments/create',
  title: 'New treatment',
  testId: 'treatment-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
