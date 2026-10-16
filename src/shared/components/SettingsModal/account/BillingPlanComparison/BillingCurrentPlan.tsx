import type { TFunction } from 'i18next';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import { PlanMark } from './BillingPlanCard.tsx';
import {
  currentPlanOf,
  isFreePlan,
  planPrice,
  sortPlansForComparison,
  wholeAmountOptions,
} from './plan-comparison.ts';
import {
  highlightLabel,
  type PlanLabelFormat,
  subscriptionStatusTone,
} from './plan-labels.ts';

const BILLING_KEYS = SETTINGS_KEYS.panels.billing;
const YOUR_PLAN_KEYS = BILLING_PLAN_KEYS.yourPlan;

/** "9 of 15 seats used" (or "9 seats used · no limit"), from the subscription's own counts. */
function seatsUsedLabel(
  subscription: BillingSubscription,
  t: TFunction,
  format: PlanLabelFormat,
): string {
  const used = format.formatNumber(subscription.seatsUsed);
  return subscription.seatsTotal === null
    ? t(YOUR_PLAN_KEYS.seatsUsedUnlimited, { used })
    : t(YOUR_PLAN_KEYS.seatsUsed, {
        used,
        total: format.formatNumber(subscription.seatsTotal),
      });
}

/**
 * The one line under the plan's name: "$30 / month · 9 of 15 seats used" on a subscription (its
 * own cycle; "billed yearly" when yearly), "Free for ever · 1 seat" on Free, a nudge with no plan.
 */
function planLine({
  current,
  subscription,
  t,
  format,
}: {
  current: BillingPlan | null;
  subscription: BillingSubscription | null;
  t: TFunction;
  format: ReturnType<typeof useLocaleFormat>;
}): string {
  if (!current) return t(YOUR_PLAN_KEYS.noPlanLine);
  if (!subscription) {
    const seats = highlightLabel({ kind: 'seats', seats: current.seatLimit }, t, format);
    return `${t(BILLING_PLAN_KEYS.plan.freeForever)} · ${seats}`;
  }
  const cycle = subscription.billingCycle;
  const price = planPrice(current, cycle);
  const cents = price.kind === 'free' ? 0 : price.monthlyCents;
  const parts = [
    `${format.formatCurrency(cents, current.currency, wholeAmountOptions(cents))} ${t(BILLING_PLAN_KEYS.plan.perMonth)}`,
  ];
  if (cycle === 'yearly' && current.priceYearly !== null) {
    parts.push(t(BILLING_PLAN_KEYS.confirm.billedYearly));
  }
  parts.push(seatsUsedLabel(subscription, t, format));
  return parts.join(' · ');
}

/** Props of {@link BillingCurrentPlan}. */
export interface BillingCurrentPlanProps {
  plans: readonly BillingPlan[];
  subscription: BillingSubscription | null;
  canManage: boolean;
  /** "Adjust plan" / "Upgrade plan" / "View plans": opens the plan picker. */
  onOpenPlans: () => void;
}

/**
 * The plan at the top of Billing, as Claude's billing page opens: the plan's mark, "<Plan> plan"
 * and one line with the price and the seats — and one button that opens the plan picker,
 * "Adjust plan" on a paid plan, "Upgrade plan" on Free, "View plans" to a member who may not
 * manage billing (or with no plan at all). The status pill shows only when the subscription needs
 * attention; when it renews or ends is the notice's to say. With no subscription the workspace is
 * on Free (the cheapest plan when it costs nothing).
 */
export function BillingCurrentPlan({
  plans,
  subscription,
  canManage,
  onOpenPlans,
}: BillingCurrentPlanProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const format = useLocaleFormat();
  const titleId = useId();
  const sorted = useMemo(() => sortPlansForComparison(plans), [plans]);
  const current = currentPlanOf({
    sorted,
    subscriptionPlanId: subscription?.planId ?? null,
  });
  const rank = current ? sorted.findIndex((plan) => plan.id === current.id) : 0;
  const upgrade = canManage && current !== null && isFreePlan(current);
  let action = t(YOUR_PLAN_KEYS.view);
  if (upgrade) action = t(YOUR_PLAN_KEYS.upgrade);
  else if (canManage && current) action = t(YOUR_PLAN_KEYS.adjust);
  // Truthiness, not `!== null`: before its data is a value a query hands over `undefined` (QA-8).
  const attentionStatus =
    subscription && subscription.status !== 'active' ? subscription.status : null;

  return (
    <section
      data-testid="billing-summary"
      aria-labelledby={titleId}
      className="flex items-center gap-3.5"
    >
      <PlanMark rank={rank} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3
            id={titleId}
            dir="auto"
            className="text-base leading-tight font-semibold tracking-tight"
          >
            {current
              ? tSettings(BILLING_KEYS.planHeading, { name: current.name })
              : tSettings(BILLING_KEYS.noPlan)}
          </h3>
          {attentionStatus ? (
            <TonePill
              tone={subscriptionStatusTone(attentionStatus)}
              size="sm"
              dot
              className="capitalize"
              data-testid="billing-status"
            >
              {attentionStatus.replace('_', ' ')}
            </TonePill>
          ) : null}
        </div>
        <p
          className="text-muted-foreground text-detail text-pretty tabular-nums"
          data-testid="billing-plan-line"
        >
          {planLine({ current, subscription, t, format })}
        </p>
      </div>
      <Button
        variant={upgrade ? 'default' : 'outline'}
        size="sm"
        className="shrink-0"
        onClick={onOpenPlans}
        data-testid="billing-adjust-plan"
      >
        {action}
      </Button>
    </section>
  );
}
