import { describe, expect, it } from 'vitest';

import type { BillingPlan } from '@/shared/api/billing-contracts.ts';

import { subscriptionFixture } from './billing-plan.fixtures.ts';
import {
  bestYearlySavingsPercent,
  comparisonSections,
  currentPlanOf,
  freePlanOf,
  isFreePlan,
  nextPlanUp,
  PLAN_FEATURE_CATALOG,
  planAudience,
  planCardAction,
  planChangeKind,
  planDifference,
  planPrice,
  planTiers,
  readPlanFeature,
  seatsOverLimit,
  sortPlansForComparison,
  subscriptionNoticeKind,
  wholeAmountOptions,
  yearlySavingsPercent,
} from './plan-comparison.ts';

function plan(overrides: Partial<BillingPlan> & Pick<BillingPlan, 'id'>): BillingPlan {
  return {
    name: overrides.id,
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

/** The four tiers clinozy-be seeds (`plan.reference.seed.ts`). */
const FREE = plan({
  id: 'pln_free',
  name: 'Free',
  seatLimit: 1,
  features: { priority_support: false, audit_log: false, sso: false },
});
const STARTER = plan({
  id: 'pln_starter',
  name: 'Starter',
  priceMonthly: 1000,
  priceYearly: 10000,
  seatLimit: 5,
  features: { priority_support: false, audit_log: true, sso: false },
});
const GROWTH = plan({
  id: 'pln_growth',
  name: 'Growth',
  priceMonthly: 3000,
  priceYearly: 30000,
  seatLimit: 15,
  features: { priority_support: false, audit_log: true, sso: false },
});
const PRO = plan({
  id: 'pln_pro',
  name: 'Pro',
  priceMonthly: 9900,
  priceYearly: 99000,
  seatLimit: 25,
  features: { priority_support: true, audit_log: true, sso: true },
});
const CATALOG = [FREE, STARTER, GROWTH, PRO];

describe('readPlanFeature', () => {
  it('reads true as included and false, absent, 0 and empty text as not', () => {
    const features = { a: true, b: false, c: 0, d: '' };
    expect(readPlanFeature(features, 'a')).toEqual({ kind: 'included' });
    for (const key of ['b', 'c', 'd', 'missing']) {
      expect(readPlanFeature(features, key)).toEqual({ kind: 'excluded' });
    }
  });

  it('keeps a number or text as the value', () => {
    expect(readPlanFeature({ branches: 3 }, 'branches')).toEqual({
      kind: 'value',
      value: 3,
    });
    expect(readPlanFeature({ tier: 'gold' }, 'tier')).toEqual({
      kind: 'value',
      value: 'gold',
    });
  });
});

describe('sortPlansForComparison', () => {
  it('puts the cheapest first and keeps the API order on a tie', () => {
    const twin = plan({ id: 'pln_twin', priceMonthly: 1000 });
    expect(
      sortPlansForComparison([PRO, STARTER, FREE, twin, GROWTH]).map((p) => p.id),
    ).toEqual(['pln_free', 'pln_starter', 'pln_twin', 'pln_growth', 'pln_pro']);
  });

  it('never reorders its input', () => {
    const input = [PRO, FREE];
    sortPlansForComparison(input);
    expect(input).toEqual([PRO, FREE]);
  });
});

describe('yearly savings', () => {
  it('rounds the saving over twelve monthly payments', () => {
    // $100 a year against $120 of months: 16.67% → 17%.
    expect(yearlySavingsPercent(STARTER)).toBe(17);
    expect(yearlySavingsPercent(PRO)).toBe(17);
  });

  it('has none for a free plan, a plan without a yearly price, or no discount', () => {
    expect(yearlySavingsPercent(FREE)).toBeNull();
    expect(yearlySavingsPercent({ ...STARTER, priceYearly: null })).toBeNull();
    expect(yearlySavingsPercent({ ...STARTER, priceYearly: 12000 })).toBeNull();
  });

  it('offers the best saving to the Yearly segment', () => {
    const deeper = plan({ id: 'pln_deep', priceMonthly: 1000, priceYearly: 9000 });
    expect(bestYearlySavingsPercent([FREE, STARTER, deeper])).toBe(25);
    expect(bestYearlySavingsPercent([FREE])).toBeNull();
  });
});

describe('planPrice', () => {
  it('reads a free plan as free on either cycle', () => {
    expect(planPrice(FREE, 'monthly')).toEqual({ kind: 'free' });
    expect(planPrice(FREE, 'yearly')).toEqual({ kind: 'free' });
  });

  it('prices monthly per month', () => {
    expect(planPrice(STARTER, 'monthly')).toEqual({
      kind: 'monthly',
      monthlyCents: 1000,
      monthlyOnly: false,
    });
  });

  it('prices yearly per month too, with the yearly total and its saving', () => {
    expect(planPrice(STARTER, 'yearly')).toEqual({
      kind: 'yearly',
      monthlyCents: 833,
      yearlyCents: 10000,
      savingsPercent: 17,
    });
  });

  it('keeps a plan without a yearly price monthly, and says so', () => {
    expect(planPrice({ ...STARTER, priceYearly: null }, 'yearly')).toEqual({
      kind: 'monthly',
      monthlyCents: 1000,
      monthlyOnly: true,
    });
  });
});

describe('planAudience', () => {
  it('reads who the plan is for from its seats', () => {
    expect(planAudience(1)).toEqual({ kind: 'solo' });
    expect(planAudience(0)).toEqual({ kind: 'solo' });
    expect(planAudience(5)).toEqual({ kind: 'team', seats: 5 });
    expect(planAudience(null)).toEqual({ kind: 'any' });
  });
});

describe('planTiers', () => {
  it('lists what the first plan includes and only what each later plan adds', () => {
    const tiers = planTiers(CATALOG);
    const summary = tiers.map((tier) => ({
      plan: tier.plan.name,
      previous: tier.previous?.name ?? null,
      adds: tier.highlights.map((highlight) =>
        highlight.kind === 'seats' ? `seats:${highlight.seats}` : highlight.feature.key,
      ),
    }));
    expect(summary).toEqual([
      { plan: 'Free', previous: null, adds: ['seats:1'] },
      { plan: 'Starter', previous: 'Free', adds: ['seats:5', 'audit_log'] },
      { plan: 'Growth', previous: 'Starter', adds: ['seats:15'] },
      { plan: 'Pro', previous: 'Growth', adds: ['seats:25', 'sso', 'priority_support'] },
    ]);
  });

  it('counts unlimited seats as more than any number, and never fewer as an addition', () => {
    const unlimited = plan({ id: 'pln_unlimited', priceMonthly: 20000, seatLimit: null });
    const fewer = plan({ id: 'pln_fewer', priceMonthly: 30000, seatLimit: 3 });
    const [, unlimitedTier, fewerTier] = planTiers([PRO, unlimited, fewer]);
    expect(unlimitedTier?.highlights).toEqual([{ kind: 'seats', seats: null }]);
    expect(fewerTier?.highlights).toEqual([]);
  });

  it('adds a capability whose value improves, with the value', () => {
    const small = plan({ id: 'pln_small', features: { branches: 1 } });
    const large = plan({ id: 'pln_large', priceMonthly: 100, features: { branches: 3 } });
    // `branches` is not in the catalog: an unknown key is never listed.
    expect(planTiers([small, large])[1]?.highlights).toEqual([]);

    const valued = plan({
      id: 'pln_valued',
      priceMonthly: 100,
      features: { audit_log: '90 days' },
    });
    const [auditLog] = PLAN_FEATURE_CATALOG;
    expect(planTiers([FREE, valued])[1]?.highlights).toContainEqual({
      kind: 'feature',
      feature: auditLog,
      value: { kind: 'value', value: '90 days' },
    });
  });
});

describe('comparisonSections', () => {
  it('groups pricing, team and the capabilities some plan includes', () => {
    expect(comparisonSections(CATALOG)).toEqual([
      { id: 'pricing', rows: [{ kind: 'monthly' }, { kind: 'yearly' }] },
      { id: 'team', rows: [{ kind: 'seats' }] },
      {
        id: 'features',
        rows: PLAN_FEATURE_CATALOG.map((feature) => ({ kind: 'feature', feature })),
      },
    ]);
  });

  it('leaves out a row nobody offers', () => {
    const sections = comparisonSections([FREE, { ...STARTER, priceYearly: null }]);
    expect(sections.find((section) => section.id === 'pricing')?.rows).toEqual([
      { kind: 'monthly' },
    ]);
    expect(
      sections
        .find((section) => section.id === 'features')
        ?.rows.map((row) => (row.kind === 'feature' ? row.feature.key : row.kind)),
    ).toEqual(['audit_log']);
    expect(comparisonSections([FREE]).map((section) => section.id)).toEqual([
      'pricing',
      'team',
    ]);
  });
});

describe('wholeAmountOptions', () => {
  it('drops the decimals of a whole amount only', () => {
    expect(wholeAmountOptions(1000)).toEqual({
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    expect(wholeAmountOptions(833)).toBeUndefined();
  });
});

describe('the plan in force', () => {
  it('reads a plan as Free only when it costs nothing on either cycle', () => {
    expect(isFreePlan(FREE)).toBe(true);
    expect(isFreePlan({ ...FREE, priceYearly: 0 })).toBe(true);
    expect(isFreePlan(STARTER)).toBe(false);
    expect(isFreePlan({ ...FREE, priceYearly: 5000 })).toBe(false);
  });

  it('finds Free as the cheapest plan, or none when everything has a price', () => {
    expect(freePlanOf(CATALOG)).toBe(FREE);
    expect(freePlanOf([STARTER, PRO])).toBeNull();
    expect(freePlanOf([])).toBeNull();
  });

  it('is the subscribed plan, or Free when there is no subscription', () => {
    expect(currentPlanOf({ sorted: CATALOG, subscriptionPlanId: 'pln_growth' })).toBe(
      GROWTH,
    );
    expect(currentPlanOf({ sorted: CATALOG, subscriptionPlanId: null })).toBe(FREE);
    expect(
      currentPlanOf({ sorted: [STARTER, PRO], subscriptionPlanId: null }),
    ).toBeNull();
    // A subscription on a plan no longer offered is not silently read as Free.
    expect(
      currentPlanOf({ sorted: CATALOG, subscriptionPlanId: 'pln_retired' }),
    ).toBeNull();
  });

  it('steps up to the next dearer plan, and none from the top or from nothing', () => {
    expect(nextPlanUp({ sorted: CATALOG, current: FREE })).toBe(STARTER);
    expect(nextPlanUp({ sorted: CATALOG, current: GROWTH })).toBe(PRO);
    expect(nextPlanUp({ sorted: CATALOG, current: PRO })).toBeNull();
    expect(nextPlanUp({ sorted: CATALOG, current: null })).toBeNull();
  });
});

describe('planDifference', () => {
  const keys = (lines: ReturnType<typeof planDifference>['gains']) =>
    lines.map((line) =>
      line.kind === 'seats' ? `seats:${line.seats}` : line.feature.key,
    );

  it('lists what an upgrade adds — the new seat allowance first — and loses nothing', () => {
    const difference = planDifference({ from: GROWTH, to: PRO });
    expect(difference.direction).toBe('upgrade');
    expect(keys(difference.gains)).toEqual(['seats:25', 'sso', 'priority_support']);
    expect(difference.losses).toEqual([]);
  });

  it('lists what a downgrade takes away, with the value it had', () => {
    const difference = planDifference({
      from: { ...PRO, features: { ...PRO.features, priority_support: '24 h' } },
      to: STARTER,
    });
    expect(difference.direction).toBe('downgrade');
    expect(difference.gains).toEqual([]);
    // The seats given up are the allowance the workspace HAD, not the one it moves to.
    expect(keys(difference.losses)).toEqual(['seats:25', 'sso', 'priority_support']);
    expect(difference.losses[2]).toEqual(
      expect.objectContaining({ value: { kind: 'value', value: '24 h' } }),
    );
  });

  it('counts unlimited seats as more, and leaves equal seats out', () => {
    expect(
      keys(
        planDifference({ from: PRO, to: { ...PRO, id: 'pln_max', seatLimit: null } })
          .gains,
      ),
    ).toEqual(['seats:null']);
    expect(planDifference({ from: STARTER, to: { ...STARTER, id: 'pln_twin' } })).toEqual(
      {
        direction: 'downgrade',
        gains: [],
        losses: [],
      },
    );
  });

  it('counts the seats and every capability of a first plan as gains', () => {
    const difference = planDifference({ from: null, to: STARTER });
    expect(difference.direction).toBe('upgrade');
    expect(keys(difference.gains)).toEqual(['seats:5', 'audit_log']);
  });

  it('reads a changed value as a gain on the plan moved to', () => {
    const difference = planDifference({
      from: { ...STARTER, features: { audit_log: 30 } },
      to: { ...GROWTH, features: { audit_log: 90 } },
    });
    expect(difference.gains).toEqual([
      { kind: 'seats', seats: 15 },
      expect.objectContaining({ value: { kind: 'value', value: 90 } }),
    ]);
  });
});

describe('seatsOverLimit', () => {
  it('counts the members a plan cannot seat, never below zero', () => {
    expect(seatsOverLimit({ seatsUsed: 9, seatLimit: 5 })).toBe(4);
    expect(seatsOverLimit({ seatsUsed: 3, seatLimit: 5 })).toBe(0);
    expect(seatsOverLimit({ seatsUsed: 40, seatLimit: null })).toBe(0);
  });
});

describe('planCardAction', () => {
  const subscription = subscriptionFixture({ planId: 'pln_growth' });

  it('marks the plan in force as current, for anyone', () => {
    expect(
      planCardAction({ plan: GROWTH, current: GROWTH, subscription, canManage: false }),
    ).toEqual({ kind: 'current' });
  });

  it('offers nothing else to a member who may not manage billing', () => {
    expect(
      planCardAction({ plan: PRO, current: GROWTH, subscription, canManage: false }),
    ).toEqual({ kind: 'none' });
  });

  it('upgrades to a dearer plan and switches to a cheaper one', () => {
    const at = (plan: BillingPlan) =>
      planCardAction({ plan, current: GROWTH, subscription, canManage: true });
    expect(at(PRO)).toEqual({ kind: 'upgrade' });
    expect(at(STARTER)).toEqual({ kind: 'switch' });
    expect(at(FREE)).toEqual({ kind: 'switch' });
  });

  it('reads Free as "Free from <date>" once the paid plan is set to end', () => {
    expect(
      planCardAction({
        plan: FREE,
        current: GROWTH,
        subscription: { ...subscription, cancelAtPeriodEnd: true },
        canManage: true,
      }),
    ).toEqual({ kind: 'freeFrom', date: subscription.currentPeriodEnd });
  });

  it('upgrades off Free with no subscription, and chooses when there is no plan at all', () => {
    expect(
      planCardAction({
        plan: STARTER,
        current: FREE,
        subscription: null,
        canManage: true,
      }),
    ).toEqual({ kind: 'upgrade' });
    expect(
      planCardAction({
        plan: STARTER,
        current: null,
        subscription: null,
        canManage: true,
      }),
    ).toEqual({ kind: 'choose' });
  });
});

describe('planChangeKind', () => {
  it('is a first plan without a subscription, the end of the paid plan to Free, else a change', () => {
    expect(planChangeKind({ target: STARTER, subscription: null })).toBe('first');
    expect(planChangeKind({ target: FREE, subscription: subscriptionFixture() })).toBe(
      'toFree',
    );
    expect(planChangeKind({ target: PRO, subscription: subscriptionFixture() })).toBe(
      'change',
    );
  });
});

describe('subscriptionNoticeKind', () => {
  it('has nothing to say on Free', () => {
    expect(subscriptionNoticeKind(null)).toBeNull();
  });

  it('says a plan set to end ends, whatever else its state', () => {
    expect(subscriptionNoticeKind(subscriptionFixture({ cancelAtPeriodEnd: true }))).toBe(
      'ends',
    );
    expect(
      subscriptionNoticeKind(
        subscriptionFixture({ cancelAtPeriodEnd: true, status: 'trialing' }),
      ),
    ).toBe('ends');
  });

  it.each([
    ['active', 'renews'],
    ['trialing', 'trial'],
    ['past_due', 'pastDue'],
    ['unpaid', 'pastDue'],
    ['incomplete', 'incomplete'],
    ['canceled', null],
    ['incomplete_expired', null],
    ['paused', null],
  ] as const)('reads %s as %s', (status, kind) => {
    expect(subscriptionNoticeKind(subscriptionFixture({ status }))).toBe(kind);
  });
});
