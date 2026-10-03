import type { PageManifest } from '@/lib/routes/page-manifest.ts';

/**
 * Payments room island manifest (`/organization/$organizationSlug/payments`) —
 * Collections, invoices and dues (KICKOFF §6.9). The route gates on membership and the clinic module
 * (D8, D9); in-room access is `useClinicAccess`. In the primary nav as the
 * `payments` section.
 */
export const manifest = {
  segment: 'payments',
  path: '/organization/$organizationSlug/payments',
  title: 'Payments',
  testId: 'payments-page',
  permission: 'organization:read',
  module: 'clinic-payments',
  nav: { id: 'payments', section: 'payments' },
  kind: 'leaf',
  children: [],
} as const satisfies PageManifest;
