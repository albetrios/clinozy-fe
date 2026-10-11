import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Upload report
 * (`/organization/$organizationSlug/patients/$patientId/reports/create`,
 * `S:42`; KICKOFF §6.6, D24) — Upload report — the 560px Report drawer over Reports.
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/patients/$patientId/reports/create',
  title: 'Upload report',
  testId: 'report-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
