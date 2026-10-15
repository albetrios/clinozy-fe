import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  BillingCycle,
  BillingPlan,
  BillingSubscription,
} from '@/shared/api/billing-contracts.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import { BillingPlanCard } from './BillingPlanCard.tsx';
import { BillingPlanTable } from './BillingPlanTable.tsx';
import {
  currentPlanOf,
  nextPlanUp,
  planCardAction,
  planTiers,
  sortPlansForComparison,
} from './plan-comparison.ts';

const PICKER_KEYS = BILLING_PLAN_KEYS.picker;

/**
 * Every plan in one row once the picker is wide enough (`@3xl`, 48rem — the 1040px drawer); two
 * by two below it; stacked on a phone. A count with no row of its own wraps by two.
 */
const ROW_COLUMNS: Readonly<Record<number, string>> = {
  2: '@xl:grid-cols-2',
  3: '@xl:grid-cols-2 @3xl:grid-cols-3',
  4: '@xl:grid-cols-2 @3xl:grid-cols-4',
};

/** Props of {@link BillingPlanComparison}. */
export interface BillingPlanComparisonProps {
  /** The active plans, in any order — shown cheapest first. */
  plans: readonly BillingPlan[];
  subscription: BillingSubscription | null;
  canManage: boolean;
  /** The cycle every card is priced on. */
  billingCycle: BillingCycle;
  /** The plan whose move is in flight, if any — at most one at a time. */
  pendingPlanId: string | null;
  /** A card's button: opens the confirm for that plan. */
  onChoose: (planId: string) => void;
}

/**
 * The plan picker's body, the way claude.com lays out its plans: a card per plan in one row,
 * cheapest first, each building on the one before it ("Everything in Free, plus:") and priced per
 * month; then "Compare features across plans". The grid answers to its own width (container
 * queries), so the same body works in the 1040px drawer and on a phone.
 */
export function BillingPlanComparison({
  plans,
  subscription,
  canManage,
  billingCycle,
  pendingPlanId,
  onChoose,
}: BillingPlanComparisonProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const compareTitleId = useId();
  const sorted = useMemo(() => sortPlansForComparison(plans), [plans]);
  const tiers = useMemo(() => planTiers(sorted), [sorted]);
  const current = currentPlanOf({
    sorted,
    subscriptionPlanId: subscription?.planId ?? null,
  });
  const next = nextPlanUp({ sorted, current });

  return (
    <div className="@container flex flex-col gap-8">
      <div
        className={cn('grid gap-3', ROW_COLUMNS[sorted.length] ?? ROW_COLUMNS[2])}
        data-testid="plan-options"
      >
        {tiers.map((tier, rank) => (
          <BillingPlanCard
            key={tier.plan.id}
            tier={tier}
            rank={rank}
            billingCycle={billingCycle}
            action={planCardAction({ plan: tier.plan, current, subscription, canManage })}
            nextStepUp={next?.id === tier.plan.id}
            busy={pendingPlanId === tier.plan.id}
            held={pendingPlanId !== null}
            onAction={onChoose}
          />
        ))}
      </div>
      {sorted.length > 1 ? (
        <section aria-labelledby={compareTitleId} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 id={compareTitleId} className="text-title leading-[1.3] font-semibold">
              {t(PICKER_KEYS.compareTitle)}
            </h3>
            <p className="text-muted-foreground text-xs">{t(PICKER_KEYS.compareSub)}</p>
          </div>
          <BillingPlanTable plans={sorted} currentPlanId={current?.id ?? null} />
        </section>
      ) : null}
    </div>
  );
}
