import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Payments room island manifest (`/organization/$organizationSlug/payments`) —
 * one ledger of money in and out, the pending credits and the daily cash close
 * (KICKOFF §6.9). The bare URL is the ledger itself (D24, `S:84`). The route
 * gates on membership and the clinic module (D8, D9); in-room access is
 * `useAppAccess`. In the primary nav as the `payments` section. Its children
 * are the URL-driven dialogs over the ledger — Receive (`receive`), Send
 * payment (`pay`), an entry's edit (`$paymentId/edit`) and Day close
 * (`day-close`) — and the Pending tab (`pending`), a page of its own.
 */
export const manifest = {
  segment: 'payments',
  path: '/organization/$organizationSlug/payments',
  title: 'Payments',
  testId: 'payments-page',
  permission: 'organization:read',
  module: 'app-payments',
  nav: { id: 'payments', section: 'payments' },
  kind: 'layout',
  children: ['receive', 'pay', '$paymentId/edit', 'day-close', 'pending'],
} as const satisfies PageManifest;
