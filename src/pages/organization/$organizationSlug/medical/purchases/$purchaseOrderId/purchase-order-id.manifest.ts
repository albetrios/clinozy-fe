import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Purchase order — a URL-driven dialog over Medical › Purchases
 * (`/organization/$organizationSlug/medical/purchases/$purchaseOrderId`; KICKOFF §4, D24): the read-only Purchase order view (`S:58`) of a received or paid order. The route renders nothing: the
 * Purchases page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: '$purchaseOrderId',
  path: '/organization/$organizationSlug/medical/purchases/$purchaseOrderId',
  title: 'Purchase order',
  testId: 'purchase-order-view-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'layout',
  children: ['edit', 'receive'],
} as const satisfies PageManifest;
