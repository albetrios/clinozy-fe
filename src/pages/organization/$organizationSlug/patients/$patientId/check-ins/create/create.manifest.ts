import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New check-in — a URL-driven dialog over the patient file
 * (`/organization/$organizationSlug/patients/$patientId/check-ins/create`,
 * `S:44`; KICKOFF §6.6, D24): the check-in drawer over the section it opened
 * from (`?from=`, Clinical notes by default; `?appointment=&treatment=`).
 * Gated by the file layout; in-room Patients edit is `useAppAccess`. The
 * test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/patients/$patientId/check-ins/create',
  title: 'New check-in',
  testId: 'check-in-drawer',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
