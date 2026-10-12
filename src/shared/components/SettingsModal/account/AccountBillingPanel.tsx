import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  readStripeBillingReturnParams,
  stripeReturnCleanupNavigation,
} from '@/lib/billing/stripe-return.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { cn } from '@/lib/utils.ts';
import * as billingApi from '@/shared/api/billing-api.ts';
import type {
  BillingCycle,
  BillingPlan,
  BillingSubscription,
} from '@/shared/api/billing-contracts.ts';
import { billingQueryKeys } from '@/shared/api/billing-query-keys.ts';
import { isStripeEnabled } from '@/shared/billing/stripe-config.ts';
import { type PillTone, TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { QueryBoundary } from '@/shared/components/QueryBoundary/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import { BillingCancellationSection } from '@/shared/components/SettingsModal/account/BillingCancellationSection/index.ts';
import { BillingInvoicesTable } from '@/shared/components/SettingsModal/account/BillingInvoicesTable/index.ts';
import { BillingPaymentMethods } from '@/shared/components/SettingsModal/account/BillingPaymentMethods/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { StripePaymentForm } from '@/shared/components/StripePaymentForm/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  useBillingPlans,
  useSelectBillingPlan,
  useSubscription,
} from '@/shared/hooks/useSubscription/index.ts';
import { notify } from '@/shared/notify/index.ts';

const BILLING_KEYS = SETTINGS_KEYS.panels.billing;

function planPriceLabel(
  plan: BillingPlan,
  billingCycle: BillingCycle,
  formatCurrency: (cents: number, currency: string) => string,
  t: TFunction,
) {
  // A plan without annual billing keeps its monthly price in the yearly view.
  const yearlyCents = billingCycle === 'yearly' ? plan.priceYearly : null;
  const yearly = yearlyCents !== null;
  const cents = yearlyCents ?? plan.priceMonthly;
  // A free plan still gets formatted in the viewer's locale — a hardcoded "$0"
  // was both untranslated and wrong for every non-USD workspace.
  const price = formatCurrency(cents, plan.currency);
  return t(yearly ? BILLING_KEYS.pricePerYear : BILLING_KEYS.pricePerMonth, { price });
}

function planActionLabel(
  name: string,
  hasSubscription: boolean,
  busy: boolean,
  t: TFunction,
) {
  if (busy) return t(BILLING_KEYS.switching);
  return t(hasSubscription ? BILLING_KEYS.switchTo : BILLING_KEYS.choose, { name });
}

/** A subscription status's pill tone: running sage, payment trouble blush, else plain. */
function statusTone(status: BillingSubscription['status']): PillTone {
  if (status === 'active' || status === 'trialing') return 'sage';
  if (status === 'incomplete' || status === 'past_due' || status === 'unpaid') {
    return 'blush';
  }
  return 'neutral';
}

/**
 * The plan change SUCCEEDED and the payment step did not. Silence here leaves an
 * `incomplete` subscription with no form and no message - the user has no way to
 * know money never moved (SET-13).
 */
function notifyPaymentSetupFailed() {
  notify.error(
    i18n.t(ERRORS_KEYS.frontend.hooks.subscription.paymentSetupFailed, {
      ns: ERRORS_NS,
    }),
    { id: 'billing-payment-setup' },
  );
}

/**
 * The payment step for an `incomplete` subscription. Returns null — after
 * telling the user — when it cannot be started, so no caller can leave the
 * failure silent.
 */
async function loadPaymentSetup(subscriptionId: string): Promise<string | null> {
  try {
    const setup = await billingApi.getSubscriptionPaymentSetup(subscriptionId);
    if (setup.clientSecret) return setup.clientSecret;
  } catch {
    // Same outcome as a missing secret: no form to complete.
  }
  notifyPaymentSetupFailed();
  return null;
}

interface PlanCardProps {
  plan: BillingPlan;
  current: boolean;
  canManage: boolean;
  hasSubscription: boolean;
  billingCycle: BillingCycle;
  /** The plan whose switch is in flight, if any — at most one at a time. */
  pendingPlanId: string | null;
  onSelect: (planId: string) => Promise<void>;
  formatCurrency: (cents: number, currency: string) => string;
}

/**
 * One plan in the comparison grid, with its own busy state — a tile in the
 * settings card's frame: the name 13.5px/600, the price in the 15px title step
 * (tabular), the description muted; the current plan carries the ink edge, as a
 * picked chip does (`preset.md:64`).
 */
function PlanCard({
  plan,
  current,
  canManage,
  hasSubscription,
  billingCycle,
  pendingPlanId,
  onSelect,
  formatCurrency,
}: PlanCardProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const busy = pendingPlanId === plan.id;
  let action: ReactNode = null;
  if (current) {
    action = (
      <TonePill tone="neutral" size="sm">
        {t(BILLING_KEYS.currentPlan)}
      </TonePill>
    );
  } else if (canManage) {
    action = (
      <Button
        size="sm"
        className="w-full"
        // Only the pressed plan spins; the rest are merely disabled, because
        // one of them is already being switched to (SET-13).
        isLoading={busy}
        disabled={pendingPlanId !== null}
        onClick={() => void onSelect(plan.id)}
        data-testid={`plan-${plan.id}`}
      >
        {planActionLabel(plan.name, hasSubscription, busy, t)}
      </Button>
    );
  }

  return (
    <div
      data-slot="card"
      data-current={current || undefined}
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-1.5 rounded-xl border p-(--step-pad)',
        current && 'border-foreground ring-foreground ring-1',
      )}
    >
      <h4 dir="auto" className="text-field leading-[1.3] font-semibold">
        {plan.name}
      </h4>
      <p className="text-title leading-[1.3] font-semibold tabular-nums">
        {planPriceLabel(plan, billingCycle, formatCurrency, t)}
      </p>
      <p className="text-muted-foreground text-xs leading-[1.45] text-pretty">
        {plan.description ?? t(BILLING_KEYS.planFallbackDescription)}
      </p>
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </div>
  );
}

/** The segmented track's classes (the room tabs', H:1086): a 36px `muted` track of 28px segments. */
const CYCLE_TRACK =
  'bg-muted border-muted inline-flex h-9 items-center gap-0.5 rounded-lg border p-0.75';
const CYCLE_SEGMENT =
  'text-detail h-7 rounded-md px-3 font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150';

/**
 * Monthly · Yearly, on the room tabs' segmented track: the picked segment is the
 * card with its 1px ring, the other the strong muted ink. Each segment states
 * whether it is the one in force (`aria-pressed`).
 */
function BillingCycleSwitch({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  return (
    <fieldset className={CYCLE_TRACK} data-testid="billing-cycle-toggle">
      <legend className="sr-only">{t(BILLING_KEYS.cycleLegend)}</legend>
      {(['monthly', 'yearly'] as const).map((cycle) => (
        <button
          key={cycle}
          type="button"
          aria-pressed={value === cycle}
          onClick={() => onChange(cycle)}
          data-testid={`billing-cycle-${cycle}`}
          className={cn(
            CYCLE_SEGMENT,
            value === cycle
              ? 'bg-card text-foreground ring-border shadow-(--elevation-control) ring-1'
              : 'text-muted-foreground-strong hover:bg-background/55 hover:text-foreground',
          )}
        >
          {t(cycle === 'monthly' ? BILLING_KEYS.monthly : BILLING_KEYS.yearly)}
        </button>
      ))}
    </fieldset>
  );
}

interface BillingContentProps {
  sub: BillingSubscription | null;
  plans: BillingPlan[];
}

function BillingContent({ sub, plans }: BillingContentProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { formatCurrency, formatDate } = useLocaleFormat();
  const canManage = useCan({
    permission: 'subscription:manage',
    teamOrganizationOnly: true,
  });
  const selectPlan = useSelectBillingPlan();
  const [chosenCycle, setChosenCycle] = useState<BillingCycle>('monthly');
  // clinozy-be's change-plan takes the plan alone: a subscription keeps the cycle it was created
  // on. So the cycle is chosen only before there is one, and every card is priced on it after.
  const billingCycle = sub ? sub.billingCycle : chosenCycle;
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  /**
   * Which plan button the user actually pressed. `selectPlan.isPending` is one
   * flag for the whole grid, so every plan greyed out together and none of them
   * showed a spinner - the click read as "the page froze" (SET-13).
   */
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const currentPlan = sub?.planId
    ? plans.find((plan) => plan.id === sub.planId)
    : undefined;

  const stripeEnabled = isStripeEnabled();
  const showBillingExtras = stripeEnabled && Boolean(sub);

  async function refreshBilling() {
    await queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
  }

  /**
   * Clear Stripe's return params through the router (not a raw `replaceState`), so
   * its cached location stays in sync and a later navigation cannot bring them back
   * — and KEEP the settings hash while doing it (see `stripeReturnCleanupNavigation`).
   */
  function stripStripeReturnParams() {
    void navigate(stripeReturnCleanupNavigation());
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time Stripe redirect-return read on mount; navigate is a stable router handle and refreshBilling only wraps queryClient
  useEffect(() => {
    const { paymentIntentClientSecret, redirectStatus } = readStripeBillingReturnParams();
    if (redirectStatus === 'succeeded') {
      stripStripeReturnParams();
      void refreshBilling();
      return;
    }
    if (paymentIntentClientSecret) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from Stripe redirect params
      setPaymentClientSecret(paymentIntentClientSecret);
    }
    // navigate is a stable router handle; this is a one-time redirect-return read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      sub?.status !== 'incomplete' ||
      !stripeEnabled ||
      !canManage ||
      paymentClientSecret
    ) {
      return;
    }
    // Was a silent catch: an incomplete subscription with no form, no message.
    void loadPaymentSetup(sub.id).then((clientSecret) => {
      if (clientSecret) setPaymentClientSecret(clientSecret);
    });
  }, [sub, stripeEnabled, canManage, paymentClientSecret]);

  /**
   * Never rejects. It is called from an `onClick`, where a rejection is an
   * unhandled promise and nothing else — no toast, no rollback, no clue.
   */
  async function handlePlanSelect(planId: string) {
    // A second plan cannot be chosen while the first switch is still running;
    // the ref-based guard in `useAppMutation` would silently join it to the
    // first, charging for a plan the user did not press.
    if (pendingPlanId !== null) return;
    setPendingPlanId(planId);
    try {
      const updated = await selectPlan.mutateAsync({ planId, billingCycle });
      if (updated.status !== 'incomplete' || !stripeEnabled) return;
      // The plan change itself went through — a payment step that will not
      // start is a separate failure, and needs to say so.
      const clientSecret = await loadPaymentSetup(updated.id);
      if (clientSecret) setPaymentClientSecret(clientSecret);
    } catch {
      // `useAppMutation` already toasted the mapped error; swallow so the click
      // handler cannot leave an unhandled rejection behind.
    } finally {
      setPendingPlanId(null);
    }
  }

  const summaryDescription = sub
    ? t(BILLING_KEYS.summary, {
        used: sub.seatsUsed,
        total: sub.seatsTotal ?? '∞',
        date: formatDate(sub.currentPeriodEnd),
      })
    : t(BILLING_KEYS.noSubscription);

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        data-testid="billing-summary"
        title={
          currentPlan
            ? t(BILLING_KEYS.planHeading, { name: currentPlan.name })
            : t(BILLING_KEYS.noPlan)
        }
        description={summaryDescription}
        action={
          sub ? (
            <TonePill tone={statusTone(sub.status)} dot className="capitalize">
              {sub.status.replace('_', ' ')}
            </TonePill>
          ) : undefined
        }
      >
        {sub ? (
          <p className="text-muted-foreground-strong text-xs">
            {t(
              sub.billingCycle === 'yearly'
                ? BILLING_KEYS.billedYearly
                : BILLING_KEYS.billedMonthly,
            )}
          </p>
        ) : null}
      </SettingsCard>

      {paymentClientSecret ? (
        <SettingsCard
          data-testid="billing-payment-card"
          title={t(BILLING_KEYS.completePaymentTitle)}
          description={t(BILLING_KEYS.completePaymentDescription)}
        >
          {/* Stripe Elements is third-party and mounts an iframe: a throw in
                there must cost the payment card, not the billing panel. */}
          <SectionErrorBoundary
            title={i18n.t(ERRORS_KEYS.widget.payment, { ns: ERRORS_NS })}
            testId="billing-payment-form-error"
          >
            <StripePaymentForm
              clientSecret={paymentClientSecret}
              intent="payment"
              onCancel={() => setPaymentClientSecret(null)}
              onComplete={() => {
                setPaymentClientSecret(null);
                stripStripeReturnParams();
                void refreshBilling();
              }}
            />
          </SectionErrorBoundary>
        </SettingsCard>
      ) : null}

      <BillingPaymentMethods enabled={showBillingExtras} canManage={canManage} />

      <BillingInvoicesTable enabled={showBillingExtras} />

      <SettingsCard
        title={t(BILLING_KEYS.changePlanTitle)}
        description={t(BILLING_KEYS.changePlanDescription)}
        action={
          canManage && !sub ? (
            <BillingCycleSwitch value={chosenCycle} onChange={setChosenCycle} />
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-3" data-testid="plan-options">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={sub?.planId === plan.id}
              canManage={canManage}
              // `Boolean`, not `!== null`: this was the one check in the file
              // that told `undefined` apart from `null`, and it decides whether
              // the buttons read "Choose Free" or "Switch to Free". An
              // `undefined` here therefore put "Switch to …" on every card of a
              // workspace whose own summary says "No active subscription yet.
              // Choose a plan below." — the card telling the user they are on a
              // plan while the heading above it says they are not. Every other
              // read of `sub` in this component (`sub ?`, `!sub`,
              // `Boolean(sub)`) already treats the two alike.
              hasSubscription={Boolean(sub)}
              billingCycle={billingCycle}
              pendingPlanId={pendingPlanId}
              onSelect={handlePlanSelect}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      </SettingsCard>

      {sub ? (
        // Ending a subscription is its own failure domain: a throw here must not
        // take the plan grid and the invoice history with it.
        <SectionErrorBoundary
          title={i18n.t(ERRORS_KEYS.widget.cancellation, { ns: ERRORS_NS })}
          testId="billing-cancellation-error"
        >
          <BillingCancellationSection subscription={sub} canManage={canManage} />
        </SectionErrorBoundary>
      ) : null}
    </div>
  );
}

/**
 * Account billing — current plan, payment methods, invoices, plan changes, cancellation.
 * Plan changes are gated on subscription:manage for team organizations.
 */
export function AccountBillingPanel() {
  const { t } = useTranslation(SETTINGS_NS);
  const subscriptionQuery = useSubscription();
  const plansQuery = useBillingPlans();

  return (
    <section className="flex flex-col gap-4" data-testid="settings-account-billing">
      <SectionHeader
        title={t(BILLING_KEYS.title)}
        description={t(BILLING_KEYS.description)}
      />
      {/*
        Plans on the OUTSIDE, subscription within — and the subscription boundary
        carries an `idle` fallback.

        Billing is an ACCOUNT section, so a personal workspace reaches it; but
        `subscription:read` is granted to TEAM owners only
        (clinozy-be `ownerPermissionCodesForOrganizationType`). `useSubscription` is
        gated on that permission, so in a personal workspace the query never runs
        and sits at pending + idle forever. With the subscription boundary on the
        outside and no `idle` branch, that rendered NOTHING — the plans list
        included, which needs no permission at all and was fetching fine.

        `null` is the honest value for "no subscription we may read", and it is
        the same value `getActiveSubscription` already returns when the API
        answers 403. `BillingContent` has always handled it.
      */}
      <QueryBoundary query={plansQuery} errorMessage={t(BILLING_KEYS.plansLoadFailed)}>
        {(plans) => {
          const activePlans = plans.filter((plan) => plan.isActive);
          return (
            <QueryBoundary
              query={subscriptionQuery}
              errorMessage={t(BILLING_KEYS.loadFailed)}
              idle={<BillingContent sub={null} plans={activePlans} />}
            >
              {(sub) => <BillingContent sub={sub} plans={activePlans} />}
            </QueryBoundary>
          );
        }}
      </QueryBoundary>
    </section>
  );
}
