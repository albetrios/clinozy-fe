import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The appointment drawer — a URL-driven dialog over the Appointments page
 * (`/organization/$organizationSlug/appointments/$appointmentId`, `S:28`;
 * KICKOFF §4, D24). Show is edit (status strip, chat column); `?mode=reschedule`
 * opens it as "Reschedule #<seq>"; `/$appointmentId/edit` redirects here
 * (`S:29`). The route renders nothing: the page reads the URL, resolves the
 * booking and opens the form — or, for an unknown id, stays on the page with
 * "Appointment not found · it may have been deleted" (`S:115`). Same gates as
 * the room. The test id names that drawer.
 */
export const manifest = {
  segment: '$appointmentId',
  path: '/organization/$organizationSlug/appointments/$appointmentId',
  title: 'Appointment',
  testId: 'appointment-drawer',
  permission: 'organization:read',
  module: 'app-appointments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
