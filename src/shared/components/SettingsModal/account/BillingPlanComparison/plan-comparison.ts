import type {
  BillingCycle,
  BillingPlan,
  BillingPlanFeatures,
} from '@/shared/api/billing-contracts.ts';

import { BILLING_PLAN_KEYS } from './billing-plan.constants.ts';

const FEATURE_KEYS = BILLING_PLAN_KEYS.features;

/**
 * A capability the comparison knows how to name: the wire key clinozy-be sends in a
 * plan's `features` map, and the i18n keys of its label and one-line explanation.
 */
export interface PlanFeatureDefinition {
  key: string;
  label: string;
  hint: string;
}

/**
 * The capabilities the comparison shows, in display order. clinozy-be's `features`
 * map is open (`plan.types.ts`: "only the seed and the frontend agree on keys"), so a
 * key missing here is skipped rather than shown raw — adding one is a row here plus
 * its two strings in every locale.
 */
export const PLAN_FEATURE_CATALOG: readonly PlanFeatureDefinition[] = [
  { key: 'audit_log', label: FEATURE_KEYS.auditLog, hint: FEATURE_KEYS.auditLogHint },
  { key: 'sso', label: FEATURE_KEYS.sso, hint: FEATURE_KEYS.ssoHint },
  {
    key: 'priority_support',
    label: FEATURE_KEYS.prioritySupport,
    hint: FEATURE_KEYS.prioritySupportHint,
  },
];

/** What a plan gives for one capability: included, not, or a value (a limit, a tier). */
export type PlanFeatureValue =
  { kind: 'included' } | { kind: 'excluded' } | { kind: 'value'; value: number | string };

/**
 * Reads one capability off a plan's map. `true` is included; `false`, a missing key,
 * `0` and an empty text are not; any other number or text is shown as the value.
 */
export function readPlanFeature(
  features: BillingPlanFeatures,
  key: string,
): PlanFeatureValue {
  const value = features[key];
  if (value === true) return { kind: 'included' };
  if (value === undefined || value === false || value === 0 || value === '') {
    return { kind: 'excluded' };
  }
  return { kind: 'value', value };
}

function sameFeatureValue(a: PlanFeatureValue, b: PlanFeatureValue): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'value' || (b.kind === 'value' && a.value === b.value);
}

/** Plans cheapest first, so each tier can build on the one before it; ties keep the API order. */
export function sortPlansForComparison(plans: readonly BillingPlan[]): BillingPlan[] {
  return [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly);
}

/**
 * The share of twelve monthly payments a yearly price saves, as a whole percent —
 * `null` when the plan has no yearly price, is free, or saves nothing.
 */
export function yearlySavingsPercent(plan: BillingPlan): number | null {
  if (plan.priceYearly === null || plan.priceMonthly <= 0) return null;
  const percent = Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100);
  return percent > 0 ? percent : null;
}

/** The best yearly saving any plan offers — the Yearly segment's "Save up to N%". */
export function bestYearlySavingsPercent(plans: readonly BillingPlan[]): number | null {
  let best: number | null = null;
  for (const plan of plans) {
    const percent = yearlySavingsPercent(plan);
    if (percent !== null && (best === null || percent > best)) best = percent;
  }
  return best;
}

/**
 * A plan's price as a card shows it: always per month, so every card reads in one
 * unit. Billed yearly, the monthly figure is the yearly price over twelve and the
 * yearly total rides along; a plan with no yearly price stays monthly and says so.
 */
export type PlanPrice =
  | { kind: 'free' }
  | { kind: 'monthly'; monthlyCents: number; monthlyOnly: boolean }
  | {
      kind: 'yearly';
      monthlyCents: number;
      yearlyCents: number;
      savingsPercent: number | null;
    };

/** Prices one plan on a billing cycle; see {@link PlanPrice}. */
export function planPrice(plan: BillingPlan, billingCycle: BillingCycle): PlanPrice {
  if (plan.priceMonthly <= 0 && (plan.priceYearly ?? 0) <= 0) return { kind: 'free' };
  if (billingCycle === 'yearly' && plan.priceYearly !== null) {
    return {
      kind: 'yearly',
      monthlyCents: Math.round(plan.priceYearly / 12),
      yearlyCents: plan.priceYearly,
      savingsPercent: yearlySavingsPercent(plan),
    };
  }
  return {
    kind: 'monthly',
    monthlyCents: plan.priceMonthly,
    monthlyOnly: billingCycle === 'yearly',
  };
}

/** Who a plan is for, read from its seat allowance (`null` = unlimited). */
export type PlanAudience =
  { kind: 'solo' } | { kind: 'team'; seats: number } | { kind: 'any' };

/** The tagline's audience when the plan carries no description of its own. */
export function planAudience(seatLimit: number | null): PlanAudience {
  if (seatLimit === null) return { kind: 'any' };
  if (seatLimit <= 1) return { kind: 'solo' };
  return { kind: 'team', seats: seatLimit };
}

/** Whether a seat allowance beats another: unlimited beats any number. */
function moreSeats(seats: number | null, than: number | null): boolean {
  if (than === null) return false;
  return seats === null || seats > than;
}

/** One line of a card's checklist. */
export type PlanHighlight =
  | { kind: 'seats'; seats: number | null }
  | { kind: 'feature'; feature: PlanFeatureDefinition; value: PlanFeatureValue };

/** A plan in the comparison, with the plan it builds on and what it adds. */
export interface PlanTier {
  plan: BillingPlan;
  /** The next cheaper plan — the card reads "Everything in <previous>, plus:". */
  previous: BillingPlan | null;
  highlights: PlanHighlight[];
}

/**
 * The cards' checklists, the way Claude's plan picker lists them: the first plan
 * lists what it includes; every later plan only what it adds over the previous one —
 * more seats, and each capability that is new or better. Plans arrive cheapest first.
 */
export function planTiers(plans: readonly BillingPlan[]): PlanTier[] {
  return plans.map((plan, index) => {
    const previous = index > 0 ? (plans[index - 1] ?? null) : null;
    const highlights: PlanHighlight[] = [];
    if (previous === null || moreSeats(plan.seatLimit, previous.seatLimit)) {
      highlights.push({ kind: 'seats', seats: plan.seatLimit });
    }
    for (const feature of PLAN_FEATURE_CATALOG) {
      const value = readPlanFeature(plan.features, feature.key);
      if (value.kind === 'excluded') continue;
      if (
        previous &&
        sameFeatureValue(value, readPlanFeature(previous.features, feature.key))
      ) {
        continue;
      }
      highlights.push({ kind: 'feature', feature, value });
    }
    return { plan, previous, highlights };
  });
}

/** One row of the comparison table. */
export type PlanComparisonRow =
  | { kind: 'monthly' }
  | { kind: 'yearly' }
  | { kind: 'seats' }
  | { kind: 'feature'; feature: PlanFeatureDefinition };

/** A titled group of rows in the comparison table. */
export interface PlanComparisonSection {
  id: 'pricing' | 'team' | 'features';
  rows: PlanComparisonRow[];
}

/**
 * The comparison table's sections. A row nobody offers is left out — the yearly
 * price when no plan has one, a capability no plan includes — so the table never
 * advertises a column of dashes.
 */
export function comparisonSections(
  plans: readonly BillingPlan[],
): PlanComparisonSection[] {
  const pricing: PlanComparisonRow[] = [{ kind: 'monthly' }];
  if (plans.some((plan) => plan.priceYearly !== null)) pricing.push({ kind: 'yearly' });
  const features: PlanComparisonRow[] = PLAN_FEATURE_CATALOG.filter((feature) =>
    plans.some((plan) => readPlanFeature(plan.features, feature.key).kind !== 'excluded'),
  ).map((feature) => ({ kind: 'feature', feature }));
  const sections: PlanComparisonSection[] = [
    { id: 'pricing', rows: pricing },
    { id: 'team', rows: [{ kind: 'seats' }] },
  ];
  if (features.length > 0) sections.push({ id: 'features', rows: features });
  return sections;
}

/**
 * Currency options for a large price figure: whole amounts drop their `.00` ($10,
 * not $10.00); anything else keeps the currency's own decimals ($8.33).
 */
export function wholeAmountOptions(cents: number): Intl.NumberFormatOptions | undefined {
  return cents % 100 === 0
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : undefined;
}
