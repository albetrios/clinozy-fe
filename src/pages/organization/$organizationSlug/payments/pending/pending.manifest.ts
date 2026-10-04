import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Payments › Pending (`/organization/$organizationSlug/payments/pending`,
 * `S:88`; KICKOFF §6.9, D24) — the money the clinic still has to give back or
 * take. The room's second tab: a page of its own, a child folder of the ledger
 * on disk and its sibling in the route tree. Same gates as the room (D8, D9);
 * in-room access is `useClinicAccess`. Its children are URL-driven dialogs over
 * it — Add pending (`create`) and Edit pending (`$creditId/edit`).
 */
export const manifest = {
  segment: 'pending',
  path: '/organization/$organizationSlug/payments/pending',
  title: 'Pending',
  testId: 'payments-pending-page',
  permission: 'organization:read',
  module: 'clinic-payments',
  kind: 'layout',
  children: ['create', '$creditId/edit'],
} as const satisfies PageManifest;
