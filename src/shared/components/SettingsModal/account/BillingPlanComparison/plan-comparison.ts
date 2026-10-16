import type {
  BillingCycle,
  BillingPlan,
  BillingPlanFeatures,
  BillingSubscription,
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

/** A plan that costs nothing on either cycle. */
export function isFreePlan(plan: BillingPlan): boolean {
  return plan.priceMonthly <= 0 && (plan.priceYearly ?? 0) <= 0;
}

/**
 * The plan a workspace without a paid subscription is on: the cheapest active plan, when it
 * costs nothing — clinozy-be's own reading (it holds such a workspace to that plan's seats,
 * `findFreePlanSeatCeiling`). `null` when the cheapest plan has a price.
 */
export function freePlanOf(sorted: readonly BillingPlan[]): BillingPlan | null {
  const cheapest = sorted[0];
  return cheapest && isFreePlan(cheapest) ? cheapest : null;
}

/** The plan the workspace is on: its subscription's, else Free. */
export function currentPlanOf({
  sorted,
  subscriptionPlanId,
}: {
  sorted: readonly BillingPlan[];
  subscriptionPlanId: string | null;
}): BillingPlan | null {
  if (subscriptionPlanId !== null) {
    return sorted.find((plan) => plan.id === subscriptionPlanId) ?? null;
  }
  return freePlanOf(sorted);
}

/** The plan right above the current one by price — "Next step up" and the upgrade shortcut. */
export function nextPlanUp({
  sorted,
  current,
}: {
  sorted: readonly BillingPlan[];
  current: BillingPlan | null;
}): BillingPlan | null {
  if (!current) return null;
  return sorted.find((plan) => plan.priceMonthly > current.priceMonthly) ?? null;
}

/** What a move from one plan to another changes, for the confirm. */
export interface PlanDifference {
  /** A dearer plan (by its monthly price) is an upgrade; anything else a downgrade. */
  direction: 'upgrade' | 'downgrade';
  /** More seats (the new allowance), and capabilities the new plan adds or raises. */
  gains: PlanHighlight[];
  /** Fewer seats (the allowance given up), and capabilities the new plan does not have. */
  losses: PlanHighlight[];
}

/**
 * What a move adds and takes away, as the cards' own checklist lines: the seats first, then the
 * capabilities of the catalog the cards and the table read. The price is shown beside it, not in
 * it. `from` is `null` when the workspace is on no plan at all — everything is then a gain.
 */
export function planDifference({
  from,
  to,
}: {
  from: BillingPlan | null;
  to: BillingPlan;
}): PlanDifference {
  const gains: PlanHighlight[] = [];
  const losses: PlanHighlight[] = [];
  if (!from || moreSeats(to.seatLimit, from.seatLimit)) {
    gains.push({ kind: 'seats', seats: to.seatLimit });
  } else if (moreSeats(from.seatLimit, to.seatLimit)) {
    losses.push({ kind: 'seats', seats: from.seatLimit });
  }
  for (const feature of PLAN_FEATURE_CATALOG) {
    const before = from
      ? readPlanFeature(from.features, feature.key)
      : ({ kind: 'excluded' } as const);
    const after = readPlanFeature(to.features, feature.key);
    if (sameFeatureValue(before, after)) continue;
    if (after.kind === 'excluded')
      losses.push({ kind: 'feature', feature, value: before });
    else gains.push({ kind: 'feature', feature, value: after });
  }
  const direction =
    !from || to.priceMonthly > from.priceMonthly ? 'upgrade' : 'downgrade';
  return { direction, gains, losses };
}

/**
 * How many taken seats a plan cannot hold — an upper bound on the members clinozy-be suspends,
 * the most recently joined first and never an owner (`suspendExcessActiveMembersToFitCeiling`).
 * `seats_used` counts pending invitations too and the suspension only active members, so the
 * confirm says "up to". `0` when the plan has no limit or room for everyone.
 */
export function seatsOverLimit({
  seatsUsed,
  seatLimit,
}: {
  seatsUsed: number;
  seatLimit: number | null;
}): number {
  if (seatLimit === null) return 0;
  return Math.max(0, seatsUsed - seatLimit);
}

/**
 * What a card's button does, decided from the subscription: nothing (a member who may not manage
 * billing), the plan in force, Free from the date a cancelled plan ends, or a move — which opens
 * the confirm, never the change itself.
 */
export type PlanCardAction =
  | { kind: 'none' }
  | { kind: 'current' }
  | { kind: 'freeFrom'; date: string }
  | { kind: 'choose' | 'upgrade' | 'switch' };

/** A dearer plan than the current one is a step up. */
function isStepUp(plan: BillingPlan, current: BillingPlan | null): boolean {
  return current !== null && plan.priceMonthly > current.priceMonthly;
}

/**
 * What `plan`'s button does for this workspace: the current plan is marked; a member who may not
 * manage billing gets nothing else; with no subscription a dearer plan than Free is an upgrade and
 * any other a choice; subscribed, Free is a switch (an end at period end — or "Free from" once
 * that is set), a dearer plan an upgrade, a cheaper one a switch.
 */
export function planCardAction({
  plan,
  current,
  subscription,
  canManage,
}: {
  plan: BillingPlan;
  current: BillingPlan | null;
  subscription: BillingSubscription | null;
  canManage: boolean;
}): PlanCardAction {
  if (current?.id === plan.id) return { kind: 'current' };
  if (!canManage) return { kind: 'none' };
  if (subscription && isFreePlan(plan)) {
    return subscription.cancelAtPeriodEnd
      ? { kind: 'freeFrom', date: subscription.currentPeriodEnd }
      : { kind: 'switch' };
  }
  if (isStepUp(plan, current)) return { kind: 'upgrade' };
  return subscription ? { kind: 'switch' } : { kind: 'choose' };
}

/**
 * What confirming does: start a first plan, move between paid plans, or end the paid plan at the
 * end of its period (Free — the backend's cancellation).
 */
export type PlanChangeKind = 'first' | 'change' | 'toFree';

/** Which kind of move `target` is for this workspace. */
export function planChangeKind({
  target,
  subscription,
}: {
  target: BillingPlan;
  subscription: BillingSubscription | null;
}): PlanChangeKind {
  if (!subscription) return 'first';
  return isFreePlan(target) ? 'toFree' : 'change';
}

/** Which line the Billing notice reads, by the subscription's state. */
export type SubscriptionNoticeKind =
  'renews' | 'ends' | 'trial' | 'pastDue' | 'incomplete';

/**
 * The one notice under the plan, as Claude's billing page states its subscription: set to end
 * beats everything (it carries "Resubscribe"); a trial says when it ends; a payment that failed or
 * has not gone through says so; a running plan says when it renews. `null` with no subscription
 * (Free) or one that is already over.
 */
export function subscriptionNoticeKind(
  subscription: BillingSubscription | null,
): SubscriptionNoticeKind | null {
  if (!subscription) return null;
  if (subscription.cancelAtPeriodEnd) return 'ends';
  switch (subscription.status) {
    case 'active':
      return 'renews';
    case 'trialing':
      return 'trial';
    case 'past_due':
    case 'unpaid':
      return 'pastDue';
    case 'incomplete':
      return 'incomplete';
    default:
      return null;
  }
}
