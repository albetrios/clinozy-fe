import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  BillingCycle,
  BillingPlan,
  BillingSubscription,
} from '@/shared/api/billing-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  CONFIRM_BUTTON_CLASS,
  ConfirmPanel,
} from '@/shared/components/ConfirmDialog/index.ts';
import { SETTINGS_NS } from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { ChevronRight, TriangleAlert } from '@/shared/icons/index.ts';

import { BILLING_PLAN_KEYS, BILLING_PLAN_NS } from './billing-plan.constants.ts';
import { PlanChecklist, PlanMark } from './BillingPlanCard.tsx';
import {
  planChangeKind,
  planDifference,
  type PlanHighlight,
  planPrice,
  seatsOverLimit,
  wholeAmountOptions,
} from './plan-comparison.ts';
import {
  highlightLabel,
  PLAN_DATE,
  planChangeTitle,
  planChangeWhen,
} from './plan-labels.ts';

const CONFIRM_KEYS = BILLING_PLAN_KEYS.confirm;

/** A plan as a chip: the small label above it ("Now", "New"), its mark and its name. */
function PlanChip({
  label,
  plan,
  rank,
  emphasis,
}: {
  label: string;
  plan: BillingPlan | null;
  rank: number;
  emphasis: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border p-3',
        emphasis && 'border-foreground ring-foreground ring-1',
      )}
    >
      <span className="text-muted-foreground text-tiny font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        {plan ? <PlanMark rank={rank} size="sm" /> : null}
        <span dir="auto" className="text-field truncate font-semibold">
          {plan?.name ?? '—'}
        </span>
      </span>
    </div>
  );
}

/** "Now › New": the two plans side by side, the one moved to drawn with the ink edge. */
function PlanChangeRoute({
  current,
  target,
  sorted,
  ...props
}: {
  current: BillingPlan | null;
  target: BillingPlan;
  sorted: readonly BillingPlan[];
}) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const rankOf = (plan: BillingPlan | null) =>
    plan
      ? Math.max(
          0,
          sorted.findIndex((candidate) => candidate.id === plan.id),
        )
      : 0;
  return (
    // The confirm's description slot hands this its id (`aria-describedby`).
    <div {...props} className="flex items-stretch gap-2" data-testid="plan-change-route">
      <PlanChip
        label={t(CONFIRM_KEYS.now)}
        plan={current}
        rank={rankOf(current)}
        emphasis={false}
      />
      <span aria-hidden className="text-muted-foreground grid place-items-center">
        <ChevronRight className="size-4 rtl:-scale-x-100" />
      </span>
      <PlanChip
        label={t(CONFIRM_KEYS.next)}
        plan={target}
        rank={rankOf(target)}
        emphasis
      />
    </div>
  );
}

/** A labelled line of the summary: "Price  $10 → $30 / month". */
function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-detail text-end font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** The price and the seats, before → after, on the subscription's cycle. */
function PlanChangeSummary({
  current,
  target,
  billingCycle,
}: {
  current: BillingPlan | null;
  target: BillingPlan;
  billingCycle: BillingCycle;
}) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const format = useLocaleFormat();
  const priceOf = (plan: BillingPlan) => {
    const price = planPrice(plan, billingCycle);
    const cents = price.kind === 'free' ? 0 : price.monthlyCents;
    return format.formatCurrency(cents, plan.currency, wholeAmountOptions(cents));
  };
  const seatsOf = (plan: BillingPlan) =>
    plan.seatLimit === null
      ? t(BILLING_PLAN_KEYS.compare.unlimited)
      : format.formatNumber(plan.seatLimit);
  const yearly = billingCycle === 'yearly' && target.priceYearly !== null;
  return (
    <dl className="divide-y border-y" data-testid="plan-change-summary">
      <SummaryRow label={t(CONFIRM_KEYS.price)}>
        {current ? `${priceOf(current)} → ` : null}
        {priceOf(target)}{' '}
        <span className="text-muted-foreground font-normal">
          {t(BILLING_PLAN_KEYS.plan.perMonth)}
          {yearly ? ` · ${t(CONFIRM_KEYS.billedYearly)}` : null}
        </span>
      </SummaryRow>
      <SummaryRow label={t(CONFIRM_KEYS.seats)}>
        {current ? `${seatsOf(current)} → ` : null}
        {seatsOf(target)}
      </SummaryRow>
    </dl>
  );
}

/** One list of the change under its heading — or, with nothing on it, "Nothing else changes." */
function ChangeList({
  heading,
  lines,
  tone,
  testId,
}: {
  heading: string;
  lines: readonly { key: string; label: string }[];
  tone: 'success' | 'muted';
  testId: string;
}) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  return (
    <section className="flex flex-col gap-2.5" aria-label={heading}>
      <h3 className="text-muted-foreground-strong text-xs font-medium">{heading}</h3>
      {lines.length > 0 ? (
        <PlanChecklist testId={testId} lines={lines} tone={tone} />
      ) : (
        <p className="text-muted-foreground text-detail">{t(CONFIRM_KEYS.nothingLost)}</p>
      )}
    </section>
  );
}

/**
 * "What you get" (ticked) and "What you lose" (struck through), each shown when the move has
 * any: a downgrade gives up the seats it had, an upgrade gains the new allowance. A move that
 * changes neither keeps its own heading over "Nothing else changes."
 */
function PlanChangeLines({
  current,
  target,
  upgrade,
}: {
  current: BillingPlan | null;
  target: BillingPlan;
  upgrade: boolean;
}) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const format = useLocaleFormat();
  const { gains, losses } = planDifference({ from: current, to: target });
  const toLines = (highlights: readonly PlanHighlight[]) =>
    highlights.map((highlight) => ({
      key: highlight.kind === 'seats' ? 'seats' : highlight.feature.key,
      label: highlightLabel(highlight, t, format),
    }));
  const showGains = gains.length > 0 || (upgrade && losses.length === 0);
  const showLosses = losses.length > 0 || (!upgrade && gains.length === 0);
  return (
    <>
      {showGains ? (
        <ChangeList
          heading={t(CONFIRM_KEYS.gains)}
          lines={toLines(gains)}
          tone="success"
          testId="plan-change-gains"
        />
      ) : null}
      {showLosses ? (
        <ChangeList
          heading={t(CONFIRM_KEYS.losses)}
          lines={toLines(losses)}
          tone="muted"
          testId="plan-change-losses"
        />
      ) : null}
    </>
  );
}

/** The members a smaller plan cannot seat, said before they are suspended. */
function SeatWarning({
  subscription,
  target,
}: {
  subscription: BillingSubscription | null;
  target: BillingPlan;
}) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const { formatNumber } = useLocaleFormat();
  if (!subscription) return null;
  const excess = seatsOverLimit({
    seatsUsed: subscription.seatsUsed,
    seatLimit: target.seatLimit,
  });
  if (excess === 0) return null;
  return (
    <p
      role="note"
      className={cn(
        TONE_CLASSES.butter.surface,
        'flex items-start gap-2 rounded-lg p-3 text-xs leading-[1.45]',
      )}
      data-testid="plan-change-seat-warning"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {t(CONFIRM_KEYS.seatWarning, {
          used: formatNumber(subscription.seatsUsed),
          name: target.name,
          seats: formatNumber(target.seatLimit ?? 0),
          excess: formatNumber(excess),
        })}
      </span>
    </p>
  );
}

/** Props of {@link BillingPlanChangeConfirm}. */
export interface BillingPlanChangeConfirmProps {
  /** The plan being moved to; `null` closes the confirm. */
  target: BillingPlan | null;
  /** The plan in force (Free with no subscription); `null` when there is none. */
  current: BillingPlan | null;
  /** Ranks for the plan marks (cheapest first). */
  sorted: readonly BillingPlan[];
  subscription: BillingSubscription | null;
  /** The cycle the move is priced on — the subscription's, or the one picked. */
  billingCycle: BillingCycle;
  /** Payments go through the provider: a first plan confirms a card next; changes prorate. */
  paymentsEnabled: boolean;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * The plan-change confirm — what claude.com, Paddle, Slack and GitHub show before a plan moves:
 * from → to, the price and the seats before and after, what you get or what you lose, and when it
 * takes effect (now, prorated; or at the end of the period for Free), with the members a smaller
 * plan cannot seat. The app's own confirm frame: a panel at the inline end, a sheet on a phone;
 * "Keep" takes focus, and every exit holds while the move runs.
 */
export function BillingPlanChangeConfirm({
  target,
  current,
  sorted,
  subscription,
  billingCycle,
  paymentsEnabled,
  busy,
  onConfirm,
  onDismiss,
}: BillingPlanChangeConfirmProps) {
  const { t } = useTranslation(BILLING_PLAN_NS);
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const { formatDate } = useLocaleFormat();
  const keepRef = useRef<HTMLButtonElement>(null);
  if (!target) return null;

  const kind = planChangeKind({ target, subscription });
  const upgrade = planDifference({ from: current, to: target }).direction === 'upgrade';
  const title = planChangeTitle({ target, current, upgrade, tPlan: t, tSettings });
  const when = planChangeWhen({
    kind,
    currentName: current?.name ?? '',
    endDate: subscription ? formatDate(subscription.currentPeriodEnd, PLAN_DATE) : '',
    billedThroughProvider: Boolean(subscription?.provider),
    paymentsEnabled,
    t,
  });

  return (
    <ConfirmPanel
      open
      onDismiss={onDismiss}
      busy={busy}
      title={title}
      testId="plan-change-confirm"
      initialFocusRef={keepRef}
      description={<PlanChangeRoute current={current} target={target} sorted={sorted} />}
      footer={(layout) => (
        <>
          <Button
            ref={keepRef}
            variant="outline"
            className={CONFIRM_BUTTON_CLASS[layout]}
            disabled={busy}
            onClick={onDismiss}
            data-testid="plan-change-confirm-keep"
          >
            {current
              ? t(CONFIRM_KEYS.keep, { name: current.name })
              : t(CONFIRM_KEYS.notNow)}
          </Button>
          <Button
            className={CONFIRM_BUTTON_CLASS[layout]}
            isLoading={busy}
            onClick={onConfirm}
            data-testid="plan-change-confirm-accept"
          >
            {title}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5 px-(--drawer-pad-x) py-4">
        <PlanChangeSummary
          current={current}
          target={target}
          billingCycle={billingCycle}
        />
        {/* Next to the seat numbers: the members a smaller plan cannot seat. */}
        <SeatWarning subscription={subscription} target={target} />
        <PlanChangeLines current={current} target={target} upgrade={upgrade} />
        <section className="flex flex-col gap-1">
          <h3 className="text-muted-foreground-strong text-xs font-medium">
            {t(CONFIRM_KEYS.when)}
          </h3>
          <p className="text-detail text-pretty" data-testid="plan-change-when">
            {when}
          </p>
        </section>
      </div>
    </ConfirmPanel>
  );
}
