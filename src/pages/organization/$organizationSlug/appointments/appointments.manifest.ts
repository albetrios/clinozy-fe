import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Appointments room island manifest (`/organization/$organizationSlug/appointments`) —
 * Bookings by doctor, room and machine (KICKOFF §6.4). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `appointments` section.
 */
export const manifest = {
  segment: 'appointments',
  path: '/organization/$organizationSlug/appointments',
  title: 'Appointments',
  testId: 'appointments-page',
  permission: 'organization:read',
  module: 'clinic-appointments',
  nav: { id: 'appointments', section: 'appointments' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
