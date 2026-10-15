import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
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
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { QueryBoundary } from '@/shared/components/QueryBoundary/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import { BillingCancellationSection } from '@/shared/components/SettingsModal/account/BillingCancellationSection/index.ts';
import { BillingInvoicesTable } from '@/shared/components/SettingsModal/account/BillingInvoicesTable/index.ts';
import { BillingPaymentMethods } from '@/shared/components/SettingsModal/account/BillingPaymentMethods/index.ts';
import {
  bestYearlySavingsPercent,
  BILLING_PLAN_KEYS,
  BILLING_PLAN_NS,
  BillingCurrentPlan,
  BillingPlanChangeConfirm,
  BillingPlanPicker,
  currentPlanOf,
  isFreePlan,
  sortPlansForComparison,
} from '@/shared/components/SettingsModal/account/BillingPlanComparison/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { StripePaymentForm } from '@/shared/components/StripePaymentForm/index.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import {
  useBillingPlans,
  useCancelSubscription,
  useSelectBillingPlan,
  useSubscription,
} from '@/shared/hooks/useSubscription/index.ts';
import { notify } from '@/shared/notify/index.ts';

const BILLING_KEYS = SETTINGS_KEYS.panels.billing;

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

/** The segmented track's classes (the room tabs', H:1086): a 36px `muted` track of 28px segments. */
const CYCLE_TRACK =
  'bg-muted border-muted inline-flex h-9 items-center gap-0.5 self-start rounded-lg border p-0.75';
const CYCLE_SEGMENT =
  'text-detail inline-flex h-7 items-center rounded-md px-3 font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150';

/**
 * Monthly · Yearly, on the room tabs' segmented track: the picked segment is the
 * card with its 1px ring, the other the strong muted ink. Each segment states
 * whether it is the one in force (`aria-pressed`). Yearly says what it saves —
 * "Save up to N%", the best saving any plan offers — as Claude's switch does.
 */
function BillingCycleSwitch({
  value,
  savingsPercent,
  onChange,
}: {
  value: BillingCycle;
  savingsPercent: number | null;
  onChange: (cycle: BillingCycle) => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const { t: tPlan } = useTranslation(BILLING_PLAN_NS);
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
          {cycle === 'yearly' && savingsPercent !== null ? (
            <TonePill
              tone="sage"
              size="xs"
              className="ms-1.5"
              data-testid="billing-cycle-savings"
            >
              {tPlan(BILLING_PLAN_KEYS.plan.saveUpTo, { percent: savingsPercent })}
            </TonePill>
          ) : null}
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
  /** The plan picker over Settings, and the plan whose confirm is open (null: none). */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmPlanId, setConfirmPlanId] = useState<string | null>(null);
  const cancelSubscription = useCancelSubscription();

  const sorted = useMemo(() => sortPlansForComparison(plans), [plans]);
  const current = currentPlanOf({ sorted, subscriptionPlanId: sub?.planId ?? null });
  const confirmTarget = sorted.find((plan) => plan.id === confirmPlanId) ?? null;

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
   * Never rejects; resolves whether the plan change went through. It runs from the
   * confirm's button, where a rejection is an unhandled promise and nothing else —
   * no toast, no rollback, no clue.
   */
  async function handlePlanSelect(planId: string): Promise<boolean> {
    // A second plan cannot be chosen while the first switch is still running;
    // the ref-based guard in `useAppMutation` would silently join it to the
    // first, charging for a plan the user did not press.
    if (pendingPlanId !== null) return false;
    setPendingPlanId(planId);
    try {
      const updated = await selectPlan.mutateAsync({ planId, billingCycle });
      if (updated.status !== 'incomplete' || !stripeEnabled) return true;
      // The plan change itself went through — a payment step that will not
      // start is a separate failure, and needs to say so.
      const clientSecret = await loadPaymentSetup(updated.id);
      if (clientSecret) setPaymentClientSecret(clientSecret);
      return true;
    } catch {
      // `useAppMutation` already toasted the mapped error; swallow so the click
      // handler cannot leave an unhandled rejection behind.
      return false;
    } finally {
      setPendingPlanId(null);
    }
  }

  /** Free is no subscription: moving there ends the paid plan at the end of its period. */
  async function endPaidPlan(subscriptionId: string): Promise<boolean> {
    try {
      await cancelSubscription.mutateAsync(subscriptionId);
      return true;
    } catch {
      return false;
    }
  }

  /** The confirm's button: the move, then — when it went through — back to Billing. */
  async function confirmPlanChange() {
    if (!confirmTarget) return;
    const done =
      sub && isFreePlan(confirmTarget)
        ? await endPaidPlan(sub.id)
        : await handlePlanSelect(confirmTarget.id);
    if (!done) return;
    setConfirmPlanId(null);
    setPickerOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <BillingCurrentPlan
        plans={plans}
        subscription={sub}
        canManage={canManage}
        onCompare={() => setPickerOpen(true)}
        onUpgrade={setConfirmPlanId}
      />

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

      <BillingPlanPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        plans={plans}
        subscription={sub}
        canManage={canManage}
        billingCycle={billingCycle}
        // The cycle is chosen only before there is a subscription (change-plan keeps it).
        cycleSwitch={
          canManage && !sub ? (
            <BillingCycleSwitch
              value={chosenCycle}
              savingsPercent={bestYearlySavingsPercent(plans)}
              onChange={setChosenCycle}
            />
          ) : undefined
        }
        pendingPlanId={pendingPlanId}
        onChoose={setConfirmPlanId}
      />

      <BillingPlanChangeConfirm
        target={confirmTarget}
        current={current}
        sorted={sorted}
        subscription={sub}
        billingCycle={billingCycle}
        paymentsEnabled={stripeEnabled}
        busy={pendingPlanId !== null || cancelSubscription.isPending}
        onConfirm={() => void confirmPlanChange()}
        onDismiss={() => setConfirmPlanId(null)}
      />
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
      <SettingsSectionHeader section="billing" />
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
