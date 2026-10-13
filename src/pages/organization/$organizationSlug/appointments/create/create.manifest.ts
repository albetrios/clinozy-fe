import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New appointment — a URL-driven dialog over the Appointments page
 * (`/organization/$organizationSlug/appointments/create`, `S:27`; KICKOFF §4,
 * D24). The route renders nothing: the page reads the URL and opens the
 * appointment form, prefilled from `?date=&time=&doctor=&who=&copyOf=` (the
 * date and doctor are the page's own params). Same gates as the room; in-room
 * Create is `useAppAccess`. The test id names that drawer.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/appointments/create',
  title: 'New appointment',
  testId: 'new-appointment-drawer',
  permission: 'organization:read',
  module: 'app-appointments',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
