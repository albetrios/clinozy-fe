import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Leads room island manifest (`/organization/$organizationSlug/leads`) —
 * Enquiries and their conversations, until they become patients (KICKOFF §6.3). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `leads` section.
 */
export const manifest = {
  segment: 'leads',
  path: '/organization/$organizationSlug/leads',
  title: 'Leads',
  testId: 'leads-page',
  permission: 'organization:read',
  module: 'clinic-leads',
  nav: { id: 'leads', section: 'leads' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
