import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Clinic stock room island manifest (`/organization/$organizationSlug/stock`) —
 * Clinic consumables and equipment used in procedures · not for sale (KICKOFF §6.8). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useAppAccess`. In the primary nav as the
 * `stock` section.
 */
export const manifest = {
  segment: 'stock',
  path: '/organization/$organizationSlug/stock',
  title: 'Clinic stock',
  testId: 'stock-page',
  permission: 'organization:read',
  module: 'app-stock',
  nav: { id: 'stock', section: 'stock' },
  kind: 'layout',
  children: ['items', 'purchases', 'movements', 'vendors'],
} as const satisfies PageManifest;
