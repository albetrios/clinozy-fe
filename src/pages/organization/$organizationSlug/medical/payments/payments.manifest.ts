import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Medical › Payments (`/organization/$organizationSlug/medical/payments`; KICKOFF §4, D24) —
 * the Payments ledger limited to Medical (`scope=medical`, `S:71`): receipts on Medical invoices, supplier bills on Medical orders, expenses in Medicines. Same gates as the room.
 */
export const manifest = {
  segment: 'payments',
  path: '/organization/$organizationSlug/medical/payments',
  title: 'Medical',
  testId: 'medical-payments-page',
  permission: 'organization:read',
  module: 'app-medical',
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
