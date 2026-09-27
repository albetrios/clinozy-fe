import { Component as AppLayout } from '@/shared/layouts/AppLayout/index.ts';

/**
 * Org-scoped shell — thin island wrapper around the shared AppLayout
 * (sidebar, header, command palette, `<Outlet />`). Exists so the
 * `$organizationSlug` island satisfies the 4-file contract while the visual
 * shell stays reusable in `shared/layouts/`.
 */
export function OrganizationLayout() {
  return <AppLayout />;
}
