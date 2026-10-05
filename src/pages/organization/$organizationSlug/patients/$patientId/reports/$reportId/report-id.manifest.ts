import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Report
 * (`/organization/$organizationSlug/patients/$patientId/reports/$reportId`,
 * `S:43`; KICKOFF §6.6, D24) — the report viewer — Report view (560px, read only, "Download") over Reports.
 * The route renders nothing: the section reads the URL and opens it. The
 * file layout's gate covers it; the test id names what opens.
 */
export const manifest = {
  segment: '$reportId',
  path: '/organization/$organizationSlug/patients/$patientId/reports/$reportId',
  title: 'Report',
  testId: 'report-view',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
