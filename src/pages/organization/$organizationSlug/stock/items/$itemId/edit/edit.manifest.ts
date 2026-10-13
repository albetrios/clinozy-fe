import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit item — a URL-driven dialog over Clinic stock › Items
 * (`/organization/$organizationSlug/stock/items/$itemId/edit`; KICKOFF §4, D24): Edit item (`S:75`) — a row's click; the row's "Use" is a popover with no URL. The route renders nothing: the
 * Items page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/stock/items/$itemId/edit',
  title: 'Edit item',
  testId: 'stock-item-drawer',
  permission: 'organization:read',
  module: 'app-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
