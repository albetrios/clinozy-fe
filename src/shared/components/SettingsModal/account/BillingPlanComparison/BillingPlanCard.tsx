import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { BillingCycle } from '@/shared/api/billing-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Check, Minus } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import {
  type PlanCardAction,
  planPrice,
  type PlanTier,
  wholeAmountOptions,
} from './plan-comparison.ts';
import { highlightLabel, PLAN_DATE, planTagline } from './plan-labels.ts';
import { planTierLook } from './plan-tier-look.ts';

const BILLING_KEYS = SETTINGS_KEYS.panels.billing;
const PLAN_KEYS = BILLING_PLAN_KEYS.plan;

/** A tick list of plan lines — the cards', "Your plan"'s and the confirm's. */
export function PlanChecklist({
  lines,
  testId,
  tone = 'success',
}: {
  lines: readonly { key: string; label: string }[];
  testId?: string;
  /** `muted`: a struck-through list of what a move takes away. */
  tone?: 'success' | 'muted';
}) {
  return (
    <ul className="flex flex-col gap-2" data-testid={testId}>
      {lines.map((line) => (
        <li key={line.key} className="text-detail flex items-start gap-2">
          {tone === 'success' ? (
            <Check aria-hidden className="text-success mt-0.5 size-3.5 shrink-0" />
          ) : (
            <Minus
              aria-hidden
              className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            />
          )}
          <span
            className={
              tone === 'muted' ? 'text-muted-foreground line-through' : undefined
            }
          >
            {line.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The plan's mark: its rank's icon on a disc in its room tone. */
export function PlanMark({ rank, size = 'md' }: { rank: number; size?: 'sm' | 'md' }) {
  const look = planTierLook(rank);
  const Icon = look.icon;
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center',
        size === 'md' ? 'size-10 rounded-xl' : 'size-7 rounded-lg',
        TONE_CLASSES[look.tone].surface,
      )}
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-3.5'} />
    </span>
  );
}

/** The fine print under a price: free, billed yearly with the total, monthly only, or monthly. */
function billingLine({
  tier,
  billingCycle,
  t,
  tSettings,
  formatCurrency,
}: {
  tier: PlanTier;
  billingCycle: BillingCycle;
  t: TFunction;
  tSettings: TFunction;
  formatCurrency: ReturnType<typeof useLocaleFormat>['formatCurrency'];
}): string {
  const price = planPrice(tier.plan, billingCycle);
  if (price.kind === 'free') return t(PLAN_KEYS.freeForever);
  if (price.kind === 'yearly') {
    return t(PLAN_KEYS.billedYearlyTotal, {
      price: formatCurrency(
        price.yearlyCents,
        tier.plan.currency,
        wholeAmountOptions(price.yearlyCents),
      ),
    });
  }
  return price.monthlyOnly
    ? t(PLAN_KEYS.monthlyOnly)
    : tSettings(BILLING_KEYS.billedMonthly);
}

/** A large per-month figure, its unit, the saving (billed yearly) and how it is billed. */
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
  const savings = price.kind === 'yearly' ? price.savingsPercent : null;

  return (
    <div className="flex flex-col gap-1.5" data-testid={`plan-price-${plan.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
          {formatCurrency(monthlyCents, plan.currency, wholeAmountOptions(monthlyCents))}
        </span>
        <span className="text-muted-foreground text-xs">{t(PLAN_KEYS.perMonth)}</span>
        {savings === null ? null : (
          <TonePill
            tone="sage"
            size="sm"
            className="ms-auto self-center"
            data-testid={`plan-savings-${plan.id}`}
          >
            {t(PLAN_KEYS.save, { percent: savings })}
          </TonePill>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-[1.45]">
        {billingLine({ tier, billingCycle, t, tSettings, formatCurrency })}
      </p>
    </div>
  );
}

/** The label of a move button: "Switching…" while it runs, else what it does. */
function moveLabel({
  kind,
  name,
  busy,
  t,
  tPlan,
}: {
  kind: 'choose' | 'upgrade' | 'switch';
  name: string;
  busy: boolean;
  t: TFunction;
  tPlan: TFunction;
}): string {
  if (busy) return t(BILLING_KEYS.switching);
  if (kind === 'upgrade') return tPlan(BILLING_PLAN_KEYS.upgradeTo, { name });
  if (kind === 'switch') return t(BILLING_KEYS.switchTo, { name });
  return t(BILLING_KEYS.choose, { name });
}

/** The card's one button, per {@link PlanCardAction}. */
function PlanCardControl({
  planId,
  name,
  action,
  busy,
  held,
  onAction,
}: {
  planId: string;
  name: string;
  action: PlanCardAction;
  busy: boolean;
  held: boolean;
  onAction: (planId: string) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tPlan } = useTranslation(BILLING_PLAN_NS);
  const { formatDate } = useLocaleFormat();

  if (action.kind === 'none') return null;
  if (action.kind === 'current' || action.kind === 'freeFrom') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled
        data-testid={
          action.kind === 'current' ? 'plan-current' : `plan-free-from-${planId}`
        }
      >
        {action.kind === 'current'
          ? t(BILLING_KEYS.currentPlan)
          : tPlan(PLAN_KEYS.freeFrom, { date: formatDate(action.date, PLAN_DATE) })}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      // A switch down is the quieter button; choosing and upgrading lead.
      variant={action.kind === 'switch' ? 'outline' : 'default'}
      className="w-full"
      isLoading={busy}
      disabled={held || busy}
      onClick={() => onAction(planId)}
      data-testid={`plan-${planId}`}
    >
      {moveLabel({ kind: action.kind, name, busy, t, tPlan })}
    </Button>
  );
}

/** The checklist's heading: what the first plan includes, or what a later one builds on. */
function checklistHeading(tier: PlanTier, t: TFunction): string {
  if (tier.previous === null) return t(PLAN_KEYS.includes);
  const key =
    tier.highlights.length > 0 ? PLAN_KEYS.everythingInPlus : PLAN_KEYS.everythingIn;
  return t(key, { name: tier.previous.name });
}

/** Props of {@link BillingPlanCard}. */
export interface BillingPlanCardProps {
  tier: PlanTier;
  /** The plan's place among the plans, cheapest first — its mark. */
  rank: number;
  billingCycle: BillingCycle;
  action: PlanCardAction;
  /** The plan right above the current one carries "Next step up". */
  nextStepUp: boolean;
  /** The move in flight is this plan's. */
  busy: boolean;
  /** Another move is in flight: this card's button holds. */
  held: boolean;
  onAction: (planId: string) => void;
}

/**
 * One plan in the picker, as claude.com draws one: its mark, the name and who it is for, a large
 * per-month price with its fine print, one action that says what it does, then the checklist —
 * "Includes:" on the first plan, "Everything in <previous>, plus:" on each later one. The current
 * plan carries the ink edge, as a picked chip does (`preset.md:64`).
 */
export function BillingPlanCard({
  tier,
  rank,
  billingCycle,
  action,
  nextStepUp,
  busy,
  held,
  onAction,
}: BillingPlanCardProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const format = useLocaleFormat();
  const { plan } = tier;
  const current = action.kind === 'current';

  return (
    <article
      data-slot="card"
      data-current={current || undefined}
      data-testid={`plan-card-${plan.id}`}
      aria-labelledby={`plan-name-${plan.id}`}
      className={cn(
        'bg-card text-card-foreground flex min-w-0 flex-col gap-4 rounded-2xl border p-5',
        current && 'border-foreground ring-foreground ring-1',
      )}
    >
      <div className="flex min-h-10 items-start justify-between gap-2">
        <PlanMark rank={rank} />
        {nextStepUp ? (
          <TonePill
            tone={planTierLook(rank).tone}
            size="sm"
            data-testid={`plan-next-${plan.id}`}
          >
            {t(PLAN_KEYS.nextStepUp)}
          </TonePill>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3
          id={`plan-name-${plan.id}`}
          dir="auto"
          className="text-lg leading-tight font-semibold tracking-tight"
        >
          {plan.name}
        </h3>
        <p className="text-muted-foreground min-h-[2lh] text-xs leading-[1.45] text-pretty">
          {planTagline({ plan, t, format })}
        </p>
      </div>
      <PlanPriceBlock tier={tier} billingCycle={billingCycle} />
      <PlanCardControl
        planId={plan.id}
        name={plan.name}
        action={action}
        busy={busy}
        held={held}
        onAction={onAction}
      />
      <div className="flex flex-col gap-2.5 border-t pt-4">
        <p className="text-muted-foreground-strong text-xs font-medium">
          {checklistHeading(tier, t)}
        </p>
        {tier.highlights.length > 0 ? (
          <PlanChecklist
            testId={`plan-highlights-${plan.id}`}
            lines={tier.highlights.map((highlight) => ({
              key: highlight.kind === 'seats' ? 'seats' : highlight.feature.key,
              label: highlightLabel(highlight, t, format),
            }))}
          />
        ) : null}
      </div>
    </article>
  );
}
