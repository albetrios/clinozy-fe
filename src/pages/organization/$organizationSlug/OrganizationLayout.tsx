import { SetupDrawerLazy } from '@/shared/components/SetupDrawer/index.ts';
import { Component as AppLayout } from '@/shared/layouts/AppLayout/index.ts';

import { useRoomLanding } from './hooks/useRoomLanding/index.ts';

/**
 * Org-scoped shell — thin island wrapper around the shared AppLayout
 * (sidebar, header, command palette, `<Outlet />`). Exists so the
 * `$organizationSlug` island satisfies the 4-file contract while the visual
 * shell stays reusable in `shared/layouts/`. It also takes the member off a
 * room the access in force can't view (`useRoomLanding`, Q-U11), and mounts the clinic setup
 * drawer's host (`#setup/…` over any room, feat-clinic-setup KICKOFF §4) — here, not on the root
 * route, so the entry chunk stays as it is and a personal workspace or the picker never loads it.
 */
export function OrganizationLayout() {
  useRoomLanding();
  return (
    <>
      <AppLayout />
      <SetupDrawerLazy />
    </>
  );
}
