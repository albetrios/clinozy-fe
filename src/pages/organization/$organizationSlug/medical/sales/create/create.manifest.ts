import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * New sale — a URL-driven dialog over Medical › Sales
 * (`/organization/$organizationSlug/medical/sales/create`; KICKOFF §4, D24): New sale — the shared Invoice drawer with type Medical locked (§6.7, §6.9; `S:50`), prefilled from `?prescription=&customer=`. The route renders nothing: the
 * Sales page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'create',
  path: '/organization/$organizationSlug/medical/sales/create',
  title: 'New sale',
  testId: 'invoice-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
