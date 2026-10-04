import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The Offers tab of the Offerings room
 * (`/organization/$organizationSlug/offerings/offers`, `S:101`; KICKOFF §6.11) —
 * a literal child route of the room (D24), registered beside the Offerings tab
 * so each tab is its own page; the room's tabs link the two. Same gates as the
 * room; in-room access is `useClinicAccess`. Not in the nav: the Offerings
 * section is the room. Its children are the Offer drawer's URL-driven dialogs —
 * New offer (`create`) and Edit offer (`$offerId/edit`; `S:102–103`).
 */
export const manifest = {
  segment: 'offers',
  path: '/organization/$organizationSlug/offerings/offers',
  title: 'Offers',
  testId: 'offers-page',
  permission: 'organization:read',
  module: 'clinic-offerings',
  kind: 'layout',
  children: ['create', '$offerId'],
} as const satisfies PageManifest;
