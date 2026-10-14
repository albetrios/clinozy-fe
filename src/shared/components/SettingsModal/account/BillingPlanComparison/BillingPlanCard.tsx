import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { BillingCycle } from '@/shared/api/billing-contracts.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Check } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import {
  planAudience,
  type PlanHighlight,
  planPrice,
  type PlanTier,
  wholeAmountOptions,
} from './plan-comparison.ts';

const BILLING_KEYS = SETTINGS_KEYS.panels.billing;
const PLAN_KEYS = BILLING_PLAN_KEYS.plan;

type Formatters = ReturnType<typeof useLocaleFormat>;

/** The tagline: the plan's own description, else who it is for from its seats. */
function planTagline(tier: PlanTier, t: TFunction, format: Formatters): string {
  if (tier.plan.description) return tier.plan.description;
  const audience = planAudience(tier.plan.seatLimit);
  if (audience.kind === 'solo') return t(PLAN_KEYS.audienceSolo);
  if (audience.kind === 'any') return t(PLAN_KEYS.audienceAny);
  return t(PLAN_KEYS.audienceTeam, { seats: format.formatNumber(audience.seats) });
}

function seatsLabel(seats: number | null, t: TFunction, format: Formatters): string {
  if (seats === null) return t(PLAN_KEYS.seatsUnlimited);
  if (seats <= 1) return t(PLAN_KEYS.seatsOne);
  return t(PLAN_KEYS.seatsUpTo, { seats: format.formatNumber(seats) });
}

function highlightLabel(
  highlight: PlanHighlight,
  t: TFunction,
  format: Formatters,
): string {
  if (highlight.kind === 'seats') return seatsLabel(highlight.seats, t, format);
  const label = t(highlight.feature.label);
  if (highlight.value.kind !== 'value') return label;
  const { value } = highlight.value;
  return `${label} · ${typeof value === 'number' ? format.formatNumber(value) : value}`;
}

/** The checklist's heading: what the first plan includes, or what a later one builds on. */
function checklistHeading(tier: PlanTier, t: TFunction): string {
  if (tier.previous === null) return t(PLAN_KEYS.includes);
  const key =
    tier.highlights.length > 0 ? PLAN_KEYS.everythingInPlus : PLAN_KEYS.everythingIn;
  return t(key, { name: tier.previous.name });
}

/**
 * The price as a large per-month figure, its unit, the saving (billed yearly) and
 * the line that says how it is billed.
 */
function PlanPriceBlock({
  tier,
  billingCycle,
}: {
  tier: PlanTier;
  billingCycle: BillingCycle;
}) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const { formatCurrency } = useLocaleFormat();
  const { plan } = tier;
  const price = planPrice(plan, billingCycle);
  const monthlyCents = price.kind === 'free' ? 0 : price.monthlyCents;
  const figure = formatCurrency(
    monthlyCents,
    plan.currency,
    wholeAmountOptions(monthlyCents),
  );

  let billingLine: string;
  if (price.kind === 'free') {
    billingLine = t(PLAN_KEYS.freeForever);
  } else if (price.kind === 'yearly') {
    billingLine = t(PLAN_KEYS.billedYearlyTotal, {
      price: formatCurrency(
        price.yearlyCents,
        plan.currency,
        wholeAmountOptions(price.yearlyCents),
      ),
    });
  } else {
    billingLine = price.monthlyOnly
      ? t(PLAN_KEYS.monthlyOnly)
      : tSettings(BILLING_KEYS.billedMonthly);
  }

  return (
    <div className="flex flex-col gap-1" data-testid={`plan-price-${plan.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
          {figure}
        </span>
        <span className="text-muted-foreground text-xs">{t(PLAN_KEYS.perMonth)}</span>
        {price.kind === 'yearly' && price.savingsPercent !== null ? (
          <TonePill
            tone="sage"
            size="sm"
            className="ms-auto self-center"
            data-testid={`plan-savings-${plan.id}`}
          >
            {t(PLAN_KEYS.save, { percent: price.savingsPercent })}
          </TonePill>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs leading-[1.45]">{billingLine}</p>
    </div>
  );
}

/** Props of {@link BillingPlanCard}. */
export interface BillingPlanCardProps {
  tier: PlanTier;
  billingCycle: BillingCycle;
  /** This is the plan the subscription is on. */
  current: boolean;
  /** The current plan's monthly price — a dearer plan reads "Upgrade to …". */
  currentPriceMonthly: number | null;
  hasSubscription: boolean;
  canManage: boolean;
  /** The plan whose switch is in flight, if any — at most one at a time. */
  pendingPlanId: string | null;
  onSelect: (planId: string) => Promise<void>;
}

/**
 * One plan in the comparison, as Claude's plan picker draws one: the name and who it
 * is for, a large per-month price, one action that says what it does, then the
 * checklist — "Includes:" on the first plan, "Everything in <previous>, plus:" on
 * each later one. A tile in the settings card's frame; the current plan carries the
 * ink edge, as a picked chip does (`preset.md:64`).
 */
export function BillingPlanCard({
  tier,
  billingCycle,
  current,
  currentPriceMonthly,
  hasSubscription,
  canManage,
  pendingPlanId,
  onSelect,
}: BillingPlanCardProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tPlan } = useTranslation(BILLING_PLAN_NS);
  const format = useLocaleFormat();
  const { plan } = tier;
  const busy = pendingPlanId === plan.id;

  let action: ReactNode = null;
  if (current && canManage) {
    action = (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled
        data-testid="plan-current"
      >
        {t(BILLING_KEYS.currentPlan)}
      </Button>
    );
  } else if (current) {
    action = (
      <TonePill tone="neutral" size="sm" className="self-start">
        {t(BILLING_KEYS.currentPlan)}
      </TonePill>
    );
  } else if (canManage) {
    const upgrade =
      hasSubscription &&
      currentPriceMonthly !== null &&
      plan.priceMonthly > currentPriceMonthly;
    let label = t(BILLING_KEYS.choose, { name: plan.name });
    if (busy) label = t(BILLING_KEYS.switching);
    else if (upgrade) label = tPlan(BILLING_PLAN_KEYS.upgradeTo, { name: plan.name });
    else if (hasSubscription) label = t(BILLING_KEYS.switchTo, { name: plan.name });
    action = (
      <Button
        size="sm"
        // A switch down is the quieter button; choosing and upgrading lead.
        variant={hasSubscription && !upgrade ? 'outline' : 'default'}
        className="w-full"
        // Only the pressed plan spins; the rest are merely disabled, because
        // one of them is already being switched to (SET-13).
        isLoading={busy}
        disabled={pendingPlanId !== null}
        onClick={() => void onSelect(plan.id)}
        data-testid={`plan-${plan.id}`}
      >
        {label}
      </Button>
    );
  }

  return (
    <div
      data-slot="card"
      data-current={current || undefined}
      data-testid={`plan-card-${plan.id}`}
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-(--step-pad)',
        current && 'border-foreground ring-foreground ring-1',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h4 dir="auto" className="text-field leading-[1.3] font-semibold">
          {plan.name}
        </h4>
        <p className="text-muted-foreground text-xs leading-[1.45] text-pretty">
          {planTagline(tier, tPlan, format)}
        </p>
      </div>
      <PlanPriceBlock tier={tier} billingCycle={billingCycle} />
      {action}
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-muted-foreground-strong text-xs font-medium">
          {checklistHeading(tier, tPlan)}
        </p>
        {tier.highlights.length > 0 ? (
          <ul
            className="flex flex-col gap-1.5"
            data-testid={`plan-highlights-${plan.id}`}
          >
            {tier.highlights.map((highlight) => (
              <li
                key={highlight.kind === 'seats' ? 'seats' : highlight.feature.key}
                className="text-detail flex items-start gap-2"
              >
                <Check aria-hidden className="text-success mt-0.5 size-3.5 shrink-0" />
                <span>{highlightLabel(highlight, tPlan, format)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
