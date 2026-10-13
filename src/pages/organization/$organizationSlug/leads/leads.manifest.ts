import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Leads room island manifest (`/organization/$organizationSlug/leads`) —
 * Enquiries and their conversations, until they become patients (KICKOFF §6.3). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useAppAccess`. In the primary nav as the
 * `leads` section. Its children are URL-driven dialogs over the list — New
 * lead (`create`) and the lead drawer (`$leadId`); `$leadId/edit` redirects
 * to the drawer from `routeTree.tsx` (D24, `S:23–25`).
 */
export const manifest = {
  segment: 'leads',
  path: '/organization/$organizationSlug/leads',
  title: 'Leads',
  testId: 'leads-page',
  permission: 'organization:read',
  module: 'app-leads',
  nav: { id: 'leads', section: 'leads' },
  kind: 'layout',
  children: ['create', '$leadId'],
} as const satisfies PageManifest;
