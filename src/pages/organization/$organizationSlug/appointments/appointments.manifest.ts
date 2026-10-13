import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Appointments room island manifest (`/organization/$organizationSlug/appointments`) —
 * Bookings by doctor, room and machine (KICKOFF §6.4). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useAppAccess`. In the primary nav as the
 * `appointments` section. Its children are URL-driven dialogs over the page —
 * New appointment (`create`) and the appointment drawer (`$appointmentId`);
 * `$appointmentId/edit` redirects to the drawer from `routeTree.tsx` (D24,
 * `S:26–29`).
 */
export const manifest = {
  segment: 'appointments',
  path: '/organization/$organizationSlug/appointments',
  title: 'Appointments',
  testId: 'appointments-page',
  permission: 'organization:read',
  module: 'app-appointments',
  nav: { id: 'appointments', section: 'appointments' },
  kind: 'layout',
  children: ['create', '$appointmentId'],
} as const satisfies PageManifest;
