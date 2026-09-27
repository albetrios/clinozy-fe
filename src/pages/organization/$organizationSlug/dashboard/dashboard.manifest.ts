import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Dashboard route island manifest (`/organization/$organizationSlug/dashboard`).
 * React boundary: `route.tsx` · UI: `DashboardPage.tsx`. The page renders the
 * shell + summary widgets today; the per-product dashboard module (keyed by
 * `module` below) is the integration point that replaces the placeholder body.
 */
export const manifest = {
  segment: 'dashboard',
  path: '/organization/$organizationSlug/dashboard',
  title: 'Dashboard',
  testId: 'dashboard-page',
  permission: 'organization:read',
  /** Reference L6b module key — disabled via `VITE_DISABLED_MODULES=billing`. */
  module: 'billing',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
