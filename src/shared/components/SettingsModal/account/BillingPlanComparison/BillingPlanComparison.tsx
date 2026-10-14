import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { BillingCycle, BillingPlan } from '@/shared/api/billing-contracts.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { ChevronDown } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import { BillingPlanCard } from './BillingPlanCard.tsx';
import { BillingPlanTable } from './BillingPlanTable.tsx';
import { planTiers, sortPlansForComparison } from './plan-comparison.ts';

const COMPARE_KEYS = BILLING_PLAN_KEYS.compare;

/**
 * Every plan in one row once the card body is wide enough (`@4xl`, 56rem) — so four
 * plans read 2 × 2 in the settings panel and never three and an orphan.
 */
const ONE_ROW_COLUMNS: Readonly<Record<number, string>> = {
  3: '@4xl:grid-cols-3',
  4: '@4xl:grid-cols-4',
};

/** Props of {@link BillingPlanComparison}. */
export interface BillingPlanComparisonProps {
  /** The active plans, in any order — shown cheapest first. */
  plans: readonly BillingPlan[];
  /** The plan the subscription is on, if there is one. */
  currentPlanId: string | null;
  hasSubscription: boolean;
  canManage: boolean;
  /** The cycle every card is priced on. */
  billingCycle: BillingCycle;
  /** The plan whose switch is in flight, if any — at most one at a time. */
  pendingPlanId: string | null;
  onSelect: (planId: string) => Promise<void>;
}

/**
 * The plan comparison, the way Claude presents its own plans: a card per plan,
 * cheapest first, each building on the one before it ("Everything in Free, plus:"),
 * priced per month in one unit; then "Compare all features" opens every plan side by
 * side. The grid answers to its own width (container queries), not the viewport's,
 * because the settings panel is narrower than the screen.
 */
export function BillingPlanComparison({
  plans,
  currentPlanId,
  hasSubscription,
  canManage,
  billingCycle,
  pendingPlanId,
  onSelect,
}: BillingPlanComparisonProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const tableId = useId();
  const [compareOpen, setCompareOpen] = useState(false);
  const sorted = useMemo(() => sortPlansForComparison(plans), [plans]);
  const tiers = useMemo(() => planTiers(sorted), [sorted]);
  const currentPriceMonthly =
    sorted.find((plan) => plan.id === currentPlanId)?.priceMonthly ?? null;

  return (
    <div className="@container flex flex-col gap-3">
      <div
        className={cn('grid gap-3 @lg:grid-cols-2', ONE_ROW_COLUMNS[sorted.length])}
        data-testid="plan-options"
      >
        {tiers.map((tier) => (
          <BillingPlanCard
            key={tier.plan.id}
            tier={tier}
            billingCycle={billingCycle}
            current={tier.plan.id === currentPlanId}
            currentPriceMonthly={currentPriceMonthly}
            hasSubscription={hasSubscription}
            canManage={canManage}
            pendingPlanId={pendingPlanId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {sorted.length > 1 ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={compareOpen}
            aria-controls={tableId}
            onClick={() => setCompareOpen((open) => !open)}
            data-testid="plan-compare-toggle"
          >
            {t(COMPARE_KEYS.toggle)}
            <ChevronDown
              aria-hidden
              className={cn(
                'size-4 transition-transform duration-150 motion-reduce:transition-none',
                compareOpen && 'rotate-180',
              )}
            />
          </Button>
          <BillingPlanTable
            id={tableId}
            plans={sorted}
            currentPlanId={currentPlanId}
            hidden={!compareOpen}
          />
        </>
      ) : null}
    </div>
  );
}
