import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Offerings room island manifest (`/organization/$organizationSlug/offerings`) —
 * What the clinic sells: offerings, packages, offers and prices (KICKOFF
 * §6.11). The route gates on membership and the clinic module (D8, D9);
 * in-room access is `useClinicAccess`. In the primary nav as the `offerings`
 * section. The bare URL is the Offerings tab; its children are the Offering
 * drawer's URL-driven dialogs — New offering (`create`) and Edit offering
 * (`$offeringId/edit`) — and the Offers tab (`offers`, a page of its own;
 * D24, `S:98–101`).
 */
export const manifest = {
  segment: 'offerings',
  path: '/organization/$organizationSlug/offerings',
  title: 'Offerings',
  testId: 'offerings-page',
  permission: 'organization:read',
  module: 'clinic-offerings',
  nav: { id: 'offerings', section: 'offerings' },
  kind: 'layout',
  children: ['create', '$offeringId', 'offers'],
} as const satisfies PageManifest;
