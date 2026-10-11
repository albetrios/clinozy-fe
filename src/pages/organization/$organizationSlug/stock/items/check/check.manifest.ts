import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Stock check — a URL-driven dialog over Clinic stock › Items
 * (`/organization/$organizationSlug/stock/items/check`; KICKOFF §4, D24): Stock check (`S:76`): type what is on the shelf; only the items that differ are saved, each as an Adjust entry. The route renders nothing: the
 * Items page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'check',
  path: '/organization/$organizationSlug/stock/items/check',
  title: 'Stock check',
  testId: 'stock-check-drawer',
  permission: 'organization:read',
  module: 'app-stock',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
