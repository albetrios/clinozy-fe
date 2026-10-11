import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Payments
 * (`/organization/$organizationSlug/patients/$patientId/payments`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `app-patients`
 * module, the org status); in-room access is `useAppAccess`.
 */
export const manifest = {
  segment: 'payments',
  path: '/organization/$organizationSlug/patients/$patientId/payments',
  title: 'Payments',
  testId: 'patient-section-payments',
  permission: 'organization:read',
  module: 'app-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
