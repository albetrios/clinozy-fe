import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit check-in — a URL-driven dialog over the patient file
 * (`/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit`,
 * `S:45`; KICKOFF §6.6, D24): the check-in drawer, prefilled, over the
 * section it opened from (`?from=`, Clinical notes by default). Gated by the
 * file layout; in-room Patients edit is `useAppAccess`. The test id names
 * that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit',
  title: 'Edit check-in',
  testId: 'check-in-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
