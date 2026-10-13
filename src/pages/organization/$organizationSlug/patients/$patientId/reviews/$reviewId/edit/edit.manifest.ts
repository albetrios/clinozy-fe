import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit review — a URL-driven dialog over the patient file
 * (`/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit`,
 * `S:47`; KICKOFF §6.6, D24): the review drawer, prefilled, over the section
 * it opened from (`?from=`, Clinical notes by default). Gated by the file
 * layout; in-room Patients edit is `useAppAccess`. The test id names that
 * drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit',
  title: 'Edit review',
  testId: 'review-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
