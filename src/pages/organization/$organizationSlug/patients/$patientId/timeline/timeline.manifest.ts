import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Overview
 * (`/organization/$organizationSlug/patients/$patientId/timeline`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `app-patients`
 * module, the org status); in-room access is `useAppAccess`.
 */
export const manifest = {
  segment: 'timeline',
  path: '/organization/$organizationSlug/patients/$patientId/timeline',
  title: 'Overview',
  testId: 'patient-section-timeline',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
