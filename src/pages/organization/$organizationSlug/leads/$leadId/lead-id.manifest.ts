import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The lead drawer — a URL-driven dialog over the Leads list
 * (`/organization/$organizationSlug/leads/$leadId`, `S:24`; KICKOFF §4, D24).
 * Show is edit (draft + Save); `/leads/$leadId/edit` redirects here (`S:25`).
 * The route renders nothing: the list page reads the URL, resolves the lead
 * and opens the drawer — or, for an unknown id or a contact thread, stays on
 * the list with "Lead not found · it may have been deleted" (`S:115`). Same
 * gates as the room. The test id names that drawer.
 */
export const manifest = {
  segment: '$leadId',
  path: '/organization/$organizationSlug/leads/$leadId',
  title: 'Lead',
  testId: 'lead-drawer',
  permission: 'organization:read',
  module: 'clinic-leads',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
