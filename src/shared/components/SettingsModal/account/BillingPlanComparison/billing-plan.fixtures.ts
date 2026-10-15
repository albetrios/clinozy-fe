import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';

/** A plan for a test: Free-shaped unless overridden. */
function planFixture(
  overrides: Partial<BillingPlan> & Pick<BillingPlan, 'id' | 'name'>,
): BillingPlan {
  return {
    description: null,
    priceMonthly: 0,
    priceYearly: null,
    currency: 'usd',
    isActive: true,
    seatLimit: 1,
    features: {},
    ...overrides,
  };
}

/** clinozy-be's seeded catalog (`plan.reference.seed.ts`), deliberately out of price order. */
export const SEEDED_PLANS: readonly BillingPlan[] = [
  planFixture({
    id: 'pln_pro',
    name: 'Pro',
    priceMonthly: 9900,
    priceYearly: 99000,
    seatLimit: 25,
    features: { priority_support: true, audit_log: true, sso: true },
  }),
  planFixture({ id: 'pln_free', name: 'Free', features: { audit_log: false } }),
  planFixture({
    id: 'pln_growth',
    name: 'Growth',
    priceMonthly: 3000,
    priceYearly: 30000,
    seatLimit: 15,
    features: { audit_log: true },
  }),
  planFixture({
    id: 'pln_starter',
    name: 'Starter',
    priceMonthly: 1000,
    priceYearly: 10000,
    seatLimit: 5,
    features: { audit_log: true },
  }),
];

/** An active monthly subscription for a test, on Starter with one seat in use unless overridden. */
export function subscriptionFixture(
  overrides: Partial<BillingSubscription> = {},
): BillingSubscription {
  return {
    id: 'sub_test',
    planId: 'pln_starter',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: '2026-10-01T00:00:00.000Z',
    currentPeriodEnd: '2026-11-01T00:00:00.000Z',
    trialEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    provider: 'stripe',
    seatsTotal: 5,
    seatsUsed: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
