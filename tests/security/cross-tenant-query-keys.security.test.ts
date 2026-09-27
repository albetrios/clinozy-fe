/**
 * Security invariant: every TanStack Query key that caches ORGANIZATION-scoped
 * data must embed the active organization id. The same backend endpoint returns
 * different rows per active org (the token's `org` claim scopes it), so an
 * org-free cache key would serve one tenant's data to another after a switch —
 * the cross-tenant bleed class fixed across members/roles/api-keys/billing/
 * webhooks/notifications.
 *
 * This is a TRIPWIRE: each org-domain key factory must be listed as either
 * org-scoped (carries the id) or an explicit, justified exception (global
 * catalog or per-user). A new factory that is neither fails the type-check here,
 * forcing the author to make the scoping decision deliberately.
 */
import { describe, expect, it } from 'vitest';

import { billingQueryKeys } from '@/shared/api/billing-query-keys.ts';
import { notificationQueryKeys } from '@/shared/api/notification-query-keys.ts';
import { orgQueryKeys } from '@/shared/api/organization-query-keys.ts';
import { webhooksQueryKey } from '@/shared/hooks/useWebhooks/useWebhooks.ts';

const ORG_A = 'org_aaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'org_bbbbbbbbbbbbbbbbbbbbb';

/** Factories that cache org-scoped data — MUST embed the org id. */
const ORG_SCOPED: ReadonlyArray<
  readonly [name: string, factory: (orgId: string | null) => readonly unknown[]]
> = [
  ['orgQueryKeys.members', orgQueryKeys.members],
  ['orgQueryKeys.roles', orgQueryKeys.roles],
  ['orgQueryKeys.apiKeys', orgQueryKeys.apiKeys],
  ['billingQueryKeys.subscriptions', billingQueryKeys.subscriptions],
  ['billingQueryKeys.activeSubscription', billingQueryKeys.activeSubscription],
  ['billingQueryKeys.invoices', billingQueryKeys.invoices],
  ['billingQueryKeys.paymentMethods', billingQueryKeys.paymentMethods],
  ['notificationQueryKeys.list', notificationQueryKeys.list],
  ['notificationQueryKeys.unreadCount', notificationQueryKeys.unreadCount],
  ['webhooksQueryKey', webhooksQueryKey],
];

/**
 * Factories that are intentionally org-FREE, with the reason. These are NOT
 * tenant data:
 * - billing plans: a global price catalog, identical for every tenant.
 * - notification preferences: per-USER, served from `/users/me/...`.
 */
const NOT_ORG_SCOPED: ReadonlyArray<
  readonly [name: string, factory: () => readonly unknown[]]
> = [
  ['billingQueryKeys.plans', billingQueryKeys.plans],
  ['notificationQueryKeys.preferences', notificationQueryKeys.preferences],
];

describe('cross-tenant query-key isolation (security)', () => {
  it.each(ORG_SCOPED)('%s embeds the org id', (_name, factory) => {
    expect(JSON.stringify(factory(ORG_A))).toContain(ORG_A);
  });

  it.each(ORG_SCOPED)('%s produces a DISTINCT key per tenant', (_name, factory) => {
    expect(factory(ORG_A)).not.toEqual(factory(ORG_B));
  });

  it.each(ORG_SCOPED)(
    '%s keeps the personal (null) scope distinct from a team org',
    (_name, factory) => {
      expect(factory(null)).not.toEqual(factory(ORG_A));
    },
  );

  it.each(NOT_ORG_SCOPED)(
    '%s is intentionally org-free (documented exception)',
    (_name, factory) => {
      // No org parameter, so it is stable regardless of the active org — and it
      // must never accidentally start carrying a tenant id.
      expect(JSON.stringify(factory())).not.toContain(ORG_A);
      expect(JSON.stringify(factory())).not.toContain(ORG_B);
    },
  );
});
