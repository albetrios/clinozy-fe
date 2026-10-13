import { Component as OrganizationLayout } from '@/pages/organization/$organizationSlug/organization-slug.route.tsx';

import { CrossRoomDialogs } from './CrossRoomDialogs.tsx';

/**
 * The organization shell as the route tree mounts it: the island's layout —
 * the shared AppLayout, the rooms in its outlet — and, over whichever room is
 * showing, the drawer another room opened from it (KICKOFF §4, A-P1). The host
 * lives here, in the app layer, because it opens other rooms' drawers, which
 * no page or shared unit may import.
 */
export function Component() {
  return (
    <>
      <OrganizationLayout />
      <CrossRoomDialogs />
    </>
  );
}
