import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Photo details
 * (`/organization/$organizationSlug/patients/$patientId/images/$imageId/edit`,
 * `S:41`; KICKOFF §6.6) — the 560px drawer over Photos: name, date, album,
 * stage, body part, visit. Read-only without `patient:update`. The test id
 * names that drawer.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/patients/$patientId/images/$imageId/edit',
  title: 'Photo details',
  testId: 'patient-photo-details',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
