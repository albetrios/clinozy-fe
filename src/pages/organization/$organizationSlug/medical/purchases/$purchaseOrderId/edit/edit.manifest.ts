import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Edit purchase order — a URL-driven dialog over Medical › Purchases
 * (`/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit`; KICKOFF §4, D24): Edit purchase order (`S:59`) — only while the order is Ordered; a received or paid order opens its view instead. The route renders nothing: the
 * Purchases page reads the URL and opens the drawer its test id names; an
 * unknown id leaves the list with "<Record> not found" (`S:115`). Same gates
 * as the room.
 */
export const manifest = {
  segment: 'edit',
  path: '/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit',
  title: 'Edit purchase order',
  testId: 'purchase-order-drawer',
  permission: 'organization:read',
  module: 'clinic-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
