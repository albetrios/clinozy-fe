import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patient file › Invoices
 * (`/organization/$organizationSlug/patients/$patientId/invoices`; KICKOFF §6.6,
 * D26). The file layout's gate covers it (membership, the `clinic-patients`
 * module, the org status); in-room access is `useClinicAccess`.
 */
export const manifest = {
  segment: 'invoices',
  path: '/organization/$organizationSlug/patients/$patientId/invoices',
  title: 'Invoices',
  testId: 'patient-section-invoices',
  permission: 'organization:read',
  module: 'clinic-patients',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
