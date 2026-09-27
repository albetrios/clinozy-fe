import { describe, expect, it } from 'vitest';

import { billingQueryKeys } from './billing-query-keys.ts';

describe('billingQueryKeys', () => {
  it('keeps plans a global catalog (not org-scoped)', () => {
    expect(billingQueryKeys.plans()).toEqual(['billing', 'plans']);
  });

  it('scopes the subscription/invoices/cards by organization id', () => {
    expect(billingQueryKeys.activeSubscription('org_1')).toEqual([
      'billing',
      'org',
      'org_1',
      'active-subscription',
    ]);
    expect(billingQueryKeys.invoices('org_1')).toEqual([
      'billing',
      'org',
      'org_1',
      'invoices',
    ]);
    expect(billingQueryKeys.paymentMethods('org_1')).toEqual([
      'billing',
      'org',
      'org_1',
      'payment-methods',
    ]);
  });

  it('produces different keys for two tenants (no cross-org collision)', () => {
    expect(billingQueryKeys.activeSubscription('org_1')).not.toEqual(
      billingQueryKeys.activeSubscription('org_2'),
    );
    // The bare `all` prefix still invalidates the whole billing domain.
    expect(billingQueryKeys.invoices('org_1').slice(0, 1)).toEqual([
      ...billingQueryKeys.all,
    ]);
  });
});
