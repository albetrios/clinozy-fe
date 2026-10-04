import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Log a review — a URL-driven dialog over the patient file
 * (`/organization/$organizationSlug/patients/$patientId/reviews/create`,
 * `S:46`; KICKOFF §6.6, D24): the review drawer over the section it opened
 * from (`?from=`, Clinical notes by default; `?source=&appointment=`). Gated
 * by the file layout; in-room Patients edit is `useClinicAccess`. The test id
 * names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/patients/$patientId/reviews/create',
  title: 'Log a review',
  testId: 'review-drawer',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
