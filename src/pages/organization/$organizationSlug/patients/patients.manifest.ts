import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Patients room island manifest (`/organization/$organizationSlug/patients`) —
 * Registered patients, with prescriptions, sessions and photos (KICKOFF §6.5). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useAppAccess`. In the primary nav as the
 * `patients` section. Its children are a URL-driven dialog over the list —
 * New patient (`create`, D24, `S:31`) — and the patient file (`$patientId`,
 * KICKOFF §6.6), a layout island of its own.
 */
export const manifest = {
  segment: 'patients',
  path: '/organization/$organizationSlug/patients',
  title: 'Patients',
  testId: 'patients-page',
  permission: 'organization:read',
  module: 'app-patients',
  nav: { id: 'patients', section: 'patients' },
  kind: 'layout',
  children: ['create', '$patientId'],
} as const satisfies PageManifest;
