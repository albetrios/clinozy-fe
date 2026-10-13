import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Receive goods — a URL-driven dialog over Medical › Purchases
 * (`/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive`; KICKOFF §4, D24): Receive goods (`S:60`): tick what arrived, with each batch and expiry. The route renders nothing: the
 * Purchases page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'receive',
  path: '/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive',
  title: 'Receive goods',
  testId: 'receive-goods-drawer',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
