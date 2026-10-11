import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Sale — a URL-driven dialog over Medical › Sales
 * (`/organization/$organizationSlug/medical/sales/$saleId`; KICKOFF §4, D24): the read-only Sale drawer (`S:51`) — a sale is changed by a return, never edited. The route renders nothing: the
 * Sales page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: '$saleId',
  path: '/organization/$organizationSlug/medical/sales/$saleId',
  title: 'Sale',
  testId: 'sale-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'layout',
  children: ['return'],
} as const satisfies PageManifest;
