import { describe, expect, it } from 'vitest';

import type { BillingPlan } from '@/shared/api/billing-contracts.ts';

import {
  bestYearlySavingsPercent,
  comparisonSections,
  PLAN_FEATURE_CATALOG,
  planAudience,
  planPrice,
  planTiers,
  readPlanFeature,
  sortPlansForComparison,
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
