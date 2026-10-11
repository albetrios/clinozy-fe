import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * The shared Invoice drawer's island (`/organization/$organizationSlug/invoices`,
 * `S:92–94`; KICKOFF §4, §6.9, D24). It has no page of its own: its routes are
 * dialogs over a referrer — the Payments ledger stands behind them, the
 * default (§4), and `from` takes the drawer back to the room that opened it.
 * Gated like the Payments room (the money domain): membership and the
 * `app-payments` module; in-room access is `useAppAccess`. Its children
 * are New invoice (`create`) and an invoice's preview (`$invoiceId`) with its
 * edit.
 */
export const manifest = {
  segment: 'invoices',
  path: '/organization/$organizationSlug/invoices',
  title: 'Invoices',
  testId: 'invoice-drawer',
  permission: 'organization:read',
  module: 'app-payments',
  kind: 'layout',
  children: ['create', '$invoiceId'],
} as const satisfies PageManifest;
