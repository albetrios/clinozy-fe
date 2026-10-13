import { Component as AppLayout } from '@/shared/layouts/AppLayout/index.ts';

import { useRoomLanding } from './hooks/useRoomLanding/index.ts';

/**
 * Org-scoped shell — thin island wrapper around the shared AppLayout
 * (sidebar, header, command palette, `<Outlet />`). Exists so the
 * `$organizationSlug` island satisfies the 4-file contract while the visual
 * shell stays reusable in `shared/layouts/`. It also takes the member off a
 * room the access in force can't view (`useRoomLanding`, Q-U11).
 */
export function OrganizationLayout() {
  useRoomLanding();
  return <AppLayout />;
}
