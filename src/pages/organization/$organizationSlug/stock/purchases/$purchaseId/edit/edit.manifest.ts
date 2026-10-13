import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit purchase — a URL-driven dialog over Clinic stock › Purchases
 * (`/organization/$organizationSlug/stock/purchases/$purchaseId/edit`; KICKOFF §4, D24): Edit purchase (`S:80`) — a row's click. The route renders nothing: the
 * Purchases page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/stock/purchases/$purchaseId/edit',
  title: 'Edit purchase',
  testId: 'stock-purchase-drawer',
  permission: 'organization:read',
  module: 'app-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
