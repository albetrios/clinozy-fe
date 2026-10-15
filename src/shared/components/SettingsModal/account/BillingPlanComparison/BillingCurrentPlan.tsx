import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Progress } from '@/shared/components/ui/progress.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ArrowUpRight } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import { PlanChecklist, PlanMark } from './BillingPlanCard.tsx';
import {
  currentPlanOf,
  nextPlanUp,
  PLAN_FEATURE_CATALOG,
  type PlanHighlight,
  planPrice,
  readPlanFeature,
  sortPlansForComparison,
  wholeAmountOptions,
} from './plan-comparison.ts';
import {
  highlightLabel,
  PLAN_DATE,
  planTagline,
  subscriptionStatusTone,
} from './plan-labels.ts';

const BILLING_KEYS = SETTINGS_KEYS.panels.billing;
const YOUR_PLAN_KEYS = BILLING_PLAN_KEYS.yourPlan;

/** Everything a plan includes: its seats and each capability it has. */
function planIncludes(plan: BillingPlan): PlanHighlight[] {
  const lines: PlanHighlight[] = [{ kind: 'seats', seats: plan.seatLimit }];
  for (const feature of PLAN_FEATURE_CATALOG) {
    const value = readPlanFeature(plan.features, feature.key);
    if (value.kind !== 'excluded') lines.push({ kind: 'feature', feature, value });
  }
  return lines;
}

/** The plan's mark, "Your plan", its name, its tagline and the subscription's status. */
function CurrentPlanHead({
  current,
  rank,
  subscription,
  titleId,
}: {
  current: BillingPlan | null;
  rank: number;
  subscription: BillingSubscription | null;
  titleId: string;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tPlan } = useTranslation(BILLING_PLAN_NS);
  const format = useLocaleFormat();
  return (
    <div className="flex items-start gap-3">
      <PlanMark rank={rank} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground text-tiny font-medium tracking-wide uppercase">
          {tPlan(YOUR_PLAN_KEYS.eyebrow)}
        </span>
        <h3
          id={titleId}
          dir="auto"
          className="text-lg leading-tight font-semibold tracking-tight"
        >
          {current
            ? t(BILLING_KEYS.planHeading, { name: current.name })
            : t(BILLING_KEYS.noPlan)}
        </h3>
        {current ? (
          <p className="text-muted-foreground text-xs leading-[1.45]">
            {planTagline({ plan: current, t: tPlan, format })}
          </p>
        ) : null}
      </div>
      {subscription ? (
        <TonePill
          tone={subscriptionStatusTone(subscription.status)}
          dot
          className="capitalize"
        >
          {subscription.status.replace('_', ' ')}
        </TonePill>
      ) : null}
    </div>
  );
}

/** The price per month on the subscription's cycle, and how it is billed (or Free for ever). */
function CurrentPlanPrice({
  current,
  subscription,
}: {
  current: BillingPlan;
  subscription: BillingSubscription | null;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tPlan } = useTranslation(BILLING_PLAN_NS);
  const { formatCurrency } = useLocaleFormat();
  const cycle = subscription?.billingCycle ?? 'monthly';
  const price = planPrice(current, cycle);
  const cents = price.kind === 'free' ? 0 : price.monthlyCents;
  let billed = tPlan(BILLING_PLAN_KEYS.plan.freeForever);
  if (subscription) {
    billed = t(
      cycle === 'yearly' ? BILLING_KEYS.billedYearly : BILLING_KEYS.billedMonthly,
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
        {formatCurrency(cents, current.currency, wholeAmountOptions(cents))}
      </span>
      <span className="text-muted-foreground text-xs">
        {tPlan(BILLING_PLAN_KEYS.plan.perMonth)}
      </span>
      <span className="text-muted-foreground-strong text-xs">· {billed}</span>
    </div>
  );
}

/** The seats used of the plan's, the renewal, and the meter — or why there is no plan. */
function CurrentPlanSeats({
  current,
  subscription,
}: {
  current: BillingPlan | null;
  subscription: BillingSubscription | null;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tPlan } = useTranslation(BILLING_PLAN_NS);
  const { formatDate } = useLocaleFormat();
  if (!subscription) {
    return current ? null : (
      <p className="text-muted-foreground text-xs leading-[1.45]">
        {t(BILLING_KEYS.noSubscription)}
      </p>
    );
  }
  const total = subscription.seatsTotal;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs leading-[1.45]">
        {t(BILLING_KEYS.summary, {
          used: subscription.seatsUsed,
          total: total ?? '∞',
          date: formatDate(subscription.currentPeriodEnd, PLAN_DATE),
        })}
      </p>
      {total ? (
        <Progress
          value={Math.min(100, (subscription.seatsUsed / total) * 100)}
          aria-label={tPlan(YOUR_PLAN_KEYS.seats)}
          className="bg-muted h-1.5"
          data-testid="billing-seat-meter"
        />
      ) : null}
    </div>
  );
}

/** Props of {@link BillingCurrentPlan}. */
export interface BillingCurrentPlanProps {
  plans: readonly BillingPlan[];
  subscription: BillingSubscription | null;
  canManage: boolean;
  /** "Compare plans": opens the picker. */
  onCompare: () => void;
  /** "Upgrade to <next>": straight to that plan's confirm. */
  onUpgrade: (planId: string) => void;
}

/**
 * "Your plan" — the current plan at a glance, as Claude's own billing settings open: the plan's
 * mark, its name and status, the price on its cycle, the seats used and the renewal, what it
 * includes; then "Compare plans" and, when there is a plan above, "Upgrade to <it>". With no
 * subscription the workspace is on Free (the cheapest plan when it costs nothing).
 */
export function BillingCurrentPlan({
  plans,
  subscription,
  canManage,
  onCompare,
  onUpgrade,
}: BillingCurrentPlanProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const format = useLocaleFormat();
  const titleId = useId();
  const sorted = useMemo(() => sortPlansForComparison(plans), [plans]);
  const current = currentPlanOf({
    sorted,
    subscriptionPlanId: subscription?.planId ?? null,
  });
  const next = nextPlanUp({ sorted, current });
  const rank = current ? sorted.findIndex((plan) => plan.id === current.id) : 0;

  return (
    <section
      data-slot="card"
      data-testid="billing-summary"
      aria-labelledby={titleId}
      className="bg-card text-card-foreground flex flex-col gap-4 rounded-2xl border p-5"
    >
      <CurrentPlanHead
        current={current}
        rank={rank}
        subscription={subscription}
        titleId={titleId}
      />
      {current ? (
        <CurrentPlanPrice current={current} subscription={subscription} />
      ) : null}
      <CurrentPlanSeats current={current} subscription={subscription} />
      {current ? (
        <div className="flex flex-col gap-2.5 border-t pt-4">
          <p className="text-muted-foreground-strong text-xs font-medium">
            {t(YOUR_PLAN_KEYS.includes)}
          </p>
          <PlanChecklist
            testId="billing-current-plan-includes"
            lines={planIncludes(current).map((line) => ({
              key: line.kind === 'seats' ? 'seats' : line.feature.key,
              label: highlightLabel(line, t, format),
            }))}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCompare}
          data-testid="billing-compare-plans"
        >
          {t(BILLING_PLAN_KEYS.picker.open)}
        </Button>
        {canManage && next ? (
          <Button
            size="sm"
            onClick={() => onUpgrade(next.id)}
            data-testid="billing-upgrade-next"
          >
            {t(BILLING_PLAN_KEYS.upgradeTo, { name: next.name })}
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </section>
  );
}
