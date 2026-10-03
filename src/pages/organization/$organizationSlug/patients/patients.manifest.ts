import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patients room island manifest (`/organization/$organizationSlug/patients`) —
 * Registered patients, with prescriptions, sessions and photos (KICKOFF §6.5). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `patients` section.
 */
export const manifest = {
  segment: 'patients',
  path: '/organization/$organizationSlug/patients',
  title: 'Patients',
  testId: 'patients-page',
  permission: 'organization:read',
  module: 'clinic-patients',
  nav: { id: 'patients', section: 'patients' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
