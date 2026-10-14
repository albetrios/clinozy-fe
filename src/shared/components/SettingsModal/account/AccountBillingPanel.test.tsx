import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const {
  useSubscriptionMock,
  useBillingPlansMock,
  selectPlanMutateAsync,
  useSelectBillingPlanMock,
  navigateMock,
  getPaymentSetupMock,
  notifyErrorMock,
  stripe,
} = vi.hoisted(() => ({
  useSubscriptionMock: vi.fn(),
  useBillingPlansMock: vi.fn(),
  selectPlanMutateAsync: vi.fn(),
  useSelectBillingPlanMock: vi.fn(),
  navigateMock: vi.fn(),
  getPaymentSetupMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  /** Per-test Stripe switch — the payment step only exists when it is on. */
  stripe: { enabled: false, crash: false, cancellationCrashes: false },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/shared/billing/stripe-config.ts', () => ({
  isStripeEnabled: () => stripe.enabled,
}));

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { error: notifyErrorMock, success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/shared/components/StripePaymentForm/index.ts', () => ({
  StripePaymentForm: ({ onComplete }: { onComplete?: () => void }) => {
    if (stripe.crash) throw new Error('stripe elements exploded');
    return (
      <div data-testid="stripe-payment-form">
        <button type="button" data-testid="stripe-payment-complete" onClick={onComplete}>
          complete
        </button>
      </div>
    );
  },
}));

vi.mock(
  '@/shared/components/SettingsModal/account/BillingPaymentMethods/index.ts',
  () => ({
    BillingPaymentMethods: () => null,
  }),
);

vi.mock(
  '@/shared/components/SettingsModal/account/BillingInvoicesTable/index.ts',
  () => ({
    BillingInvoicesTable: () => null,
  }),
);

vi.mock(
  '@/shared/components/SettingsModal/account/BillingCancellationSection/index.ts',
  () => ({
    BillingCancellationSection: () => {
      if (stripe.cancellationCrashes) throw new Error('cancellation card exploded');
      return <div data-testid="billing-cancellation-card" />;
    },
  }),
);

vi.mock('@/shared/hooks/useSubscription/index.ts', () => ({
  useSubscription: useSubscriptionMock,
  useBillingPlans: useBillingPlansMock,
  useSelectBillingPlan: useSelectBillingPlanMock,
  useCancelSubscription: () => ({ mutate: vi.fn(), isPending: false }),
  useResumeSubscription: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/shared/api/billing-api.ts', () => ({
  getSubscriptionPaymentSetup: getPaymentSetupMock,
}));

import { AccountBillingPanel } from './AccountBillingPanel.tsx';

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountBillingPanel />
    </QueryClientProvider>,
  );
}

const PLANS = [
  {
    id: 'pln_free',
    name: 'Free',
    description: 'For getting started.',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'usd',
    isActive: true,
    seatLimit: 1,
    features: { audit_log: false },
  },
  {
    id: 'pln_pro',
    name: 'Pro',
    description: 'For growing teams.',
    priceMonthly: 9900,
    priceYearly: 99000,
    currency: 'usd',
    isActive: true,
    seatLimit: null,
    features: { audit_log: true },
  },
];

const SUB = {
  id: 'sub_test',
  planId: 'pln_free',
  status: 'active' as const,
  billingCycle: 'monthly' as const,
  currentPeriodStart: '2026-01-01T00:00:00.000Z',
  currentPeriodEnd: '2026-12-01T00:00:00.000Z',
  trialEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  provider: 'stripe',
  seatsTotal: 3,
  seatsUsed: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setCanManage(value: boolean) {
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.test', role: 'user' },
    isAuthenticated: true,
  });
  useOrganizationStore.setState({
    organizationType: value ? 'TEAM' : 'PERSONAL',
    permissions: value ? ['subscription:manage'] : [],
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  // Here, not on a test's last line: three tests drive the panel through the URL,
  // and a trailing reset never runs when its test FAILS — the next test then
  // inherits `?payment_intent_client_secret=…` and fails for a reason that has
  // nothing to do with it (seen while mutation-checking the hash tests).
  window.history.replaceState({}, '', '/');
  stripe.enabled = false;
  stripe.crash = false;
  stripe.cancellationCrashes = false;
  useOrganizationStore.getState().clearOrganization();
  useBillingPlansMock.mockReturnValue({
    data: PLANS,
    isPending: false,
    isLoading: false,
    isError: false,
  });
  useSelectBillingPlanMock.mockReturnValue({
    mutateAsync: selectPlanMutateAsync,
    isPending: false,
  });
});

describe('AccountBillingPanel', () => {
  it('shows a loading state', () => {
    useSubscriptionMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: true,
      isError: false,
    });
    renderPanel();
    expect(screen.getByTestId('query-skeleton')).toBeInTheDocument();
  });

  /*
   * The regression this pins: billing is an ACCOUNT section, so a personal
   * workspace reaches it — but `subscription:read` is granted to TEAM owners
   * only, so `useSubscription` is permanently disabled there. A disabled
   * TanStack query sits at pending + fetchStatus 'idle' for ever, and with the
   * subscription boundary on the OUTSIDE and no `idle` branch that rendered
   * nothing at all: the plan list, which needs no permission and was fetching
   * fine, disappeared with it. The panel looked broken.
   */
  it('still renders the plans when the subscription may not be read', () => {
    useSubscriptionMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: false,
      isError: false,
      fetchStatus: 'idle' as const,
    });
    renderPanel();
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    expect(screen.queryByTestId('query-skeleton')).not.toBeInTheDocument();
  });

  it('renders the current plan summary and plan options', () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    expect(screen.getByTestId('plan-pln_pro')).toBeInTheDocument();
  });

  /**
   * QA-8: the panel must agree with itself about whether there IS a current
   * plan. The summary and the plan cards are driven by the same `sub`, and one
   * of them used a check (`sub !== null`) that the others did not, so an
   * `undefined` — which is what a query hands over before its data is a value —
   * put "Switch to Free" on every card of a workspace whose heading said "No
   * plan. No active subscription yet. Choose a plan below."
   */
  describe('with no subscription, every part of the panel agrees', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('reads "Choose", not "Switch to", when sub is %s', (_label, value) => {
      useSubscriptionMock.mockReturnValue({
        data: value,
        isPending: false,
        isLoading: false,
        isError: false,
      });
      setCanManage(true);
      renderPanel();

      expect(screen.getByText('No plan')).toBeInTheDocument();
      expect(screen.getByTestId('plan-pln_free')).toHaveTextContent('Choose Free');
      expect(screen.getByTestId('plan-pln_pro')).toHaveTextContent('Choose Pro');
      expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
    });
  });

  it('marks the subscribed plan as current and offers an upgrade off it', () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    // The plan the subscription names is identified in two places at once: the
    // summary heading and its own card, whose button is a disabled "Current plan".
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
    expect(screen.getByTestId('plan-current')).toBeDisabled();
    expect(screen.queryByTestId('plan-pln_free')).not.toBeInTheDocument();
    // Pro costs more than Free: the button says it is an upgrade.
    expect(screen.getByTestId('plan-pln_pro')).toHaveTextContent('Upgrade to Pro');
  });

  it('offers a switch, not an upgrade, to a cheaper plan', () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, planId: 'pln_pro' },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    expect(screen.getByTestId('plan-pln_free')).toHaveTextContent('Switch to Free');
    expect(screen.queryByTestId('plan-pln_pro')).not.toBeInTheDocument();
  });

  it('draws the current plan with the ink edge', () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    const current = screen.getByText('Current plan').closest('[data-current]');
    expect(current).toHaveClass('border-foreground', 'ring-1');
  });

  it('offers the cycle on a segmented track before there is a subscription', async () => {
    const user = userEvent.setup();
    useSubscriptionMock.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    // Monthly · Yearly states which cycle is in force, and moves with a press.
    expect(screen.getByTestId('billing-cycle-monthly')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByTestId('billing-cycle-yearly'));
    expect(screen.getByTestId('billing-cycle-yearly')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('billing-cycle-monthly')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Yearly says what it saves, and every card still reads per month.
    expect(screen.getByTestId('billing-cycle-savings')).toHaveTextContent(
      'Save up to 17%',
    );
    expect(screen.getByTestId('plan-options')).toHaveTextContent('$82.50/ month');
    expect(screen.getByTestId('plan-options')).toHaveTextContent(
      'Billed yearly · $990 a year',
    );
  });

  /*
   * clinozy-be's change-plan takes `plan_id` alone (400 on `billing_cycle`): a
   * subscription keeps the cycle it was created on. A Monthly · Yearly switch
   * next to "Switch to Pro" therefore priced a cycle the switch would not use —
   * the card read "/ yr" and the subscription stayed monthly.
   */
  describe('with a subscription, its own cycle decides', () => {
    const YEARLY_SUB = { ...SUB, billingCycle: 'yearly' as const };

    it('hides the cycle switch and prices every card on the subscription cycle', () => {
      useSubscriptionMock.mockReturnValue({
        data: YEARLY_SUB,
        isPending: false,
        isLoading: false,
        isError: false,
      });
      setCanManage(true);
      renderPanel();

      expect(screen.queryByTestId('billing-cycle-toggle')).not.toBeInTheDocument();
      expect(screen.getByText('Billed yearly')).toBeInTheDocument();
      expect(screen.getByTestId('plan-options')).toHaveTextContent(
        'Billed yearly · $990 a year',
      );
      expect(screen.getByTestId('plan-options')).not.toHaveTextContent(
        /Billed monthly(?! — no yearly option)/,
      );
    });

    it('switches plan on the subscription cycle', async () => {
      useSubscriptionMock.mockReturnValue({
        data: YEARLY_SUB,
        isPending: false,
        isLoading: false,
        isError: false,
      });
      setCanManage(true);
      selectPlanMutateAsync.mockResolvedValue({ ...YEARLY_SUB, planId: 'pln_pro' });
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByTestId('plan-pln_pro'));
      expect(selectPlanMutateAsync).toHaveBeenCalledWith({
        planId: 'pln_pro',
        billingCycle: 'yearly',
      });
    });
  });

  it('switches plan when allowed', async () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    selectPlanMutateAsync.mockResolvedValue({
      ...SUB,
      planId: 'pln_pro',
      status: 'active',
    });
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByTestId('plan-pln_pro'));
    expect(selectPlanMutateAsync).toHaveBeenCalledWith({
      planId: 'pln_pro',
      billingCycle: 'monthly',
    });
  });

  it('hides plan-switch controls without the billing permission', () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(false);
    renderPanel();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-pln_pro')).not.toBeInTheDocument();
  });

  // Plan changes are a team-workspace act: a personal workspace that somehow holds
  // subscription:manage still gets no plan buttons and no cycle switch.
  it('offers no plan changes in a personal workspace, even with subscription:manage', () => {
    useSubscriptionMock.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      user: { id: 'u', email: 'a@b.test', role: 'user' },
      isAuthenticated: true,
    });
    useOrganizationStore.setState({
      organizationType: 'PERSONAL',
      permissions: ['subscription:manage'],
    });
    renderPanel();

    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-pln_pro')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-cycle-toggle')).not.toBeInTheDocument();
  });

  it('states the seats used out of the plan seats in the summary', () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    expect(screen.getByTestId('billing-summary')).toHaveTextContent('1 of 3 seats used');
  });

  it('states an unlimited plan as ∞ seats', () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, seatsTotal: null, seatsUsed: 4 },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    expect(screen.getByTestId('billing-summary')).toHaveTextContent('4 of ∞ seats used');
  });

  it('strips Stripe return params through the router after a succeeded redirect', () => {
    window.history.replaceState(
      {},
      '',
      '/organization/acme/dashboard?payment_intent_client_secret=pi_secret&redirect_status=succeeded#settings/account/billing',
    );
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    // Cleared via the router (not raw history.replaceState) so its location
    // stays in sync and a later navigation cannot reintroduce the params.
    // `hash: true`: this panel lives in the settings HASH modal, and without it
    // the router dropped `#settings/account/billing` — the modal closed under a
    // customer who had just come back from 3DS. `{ to, replace }` alone is what
    // this test used to assert, which is how that shipped.
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: '.', replace: true, hash: true }),
    );
    const updater = navigateMock.mock.calls.at(-1)?.[0]?.search as (
      prev: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(
      updater({ payment_intent_client_secret: 'pi_secret', tab: 'billing' }),
    ).toEqual({ tab: 'billing' });
  });

  it('keeps the settings hash when the in-page payment form completes', async () => {
    // The second place the params are cleared: no redirect, the customer paid
    // in the embedded form. Same navigation, same requirement — it must not
    // close the modal it is rendered in.
    stripe.enabled = true;
    window.history.replaceState(
      {},
      '',
      '/organization/acme/dashboard?payment_intent_client_secret=pi_secret#settings/account/billing',
    );
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const user = userEvent.setup();
    renderPanel();
    navigateMock.mockClear();

    await user.click(await screen.findByTestId('stripe-payment-complete'));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: '.', replace: true, hash: true }),
    );
  });

  // ── SET-13: one plan at a time, and a payment step that speaks up ─────────

  it('spins only the plan that was pressed', async () => {
    // Regression: `disabled={selectPlan.isPending}` is one flag for the whole
    // grid, so every plan greyed out together and none of them span — the click
    // read as "the page froze".
    useSubscriptionMock.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    // Never settles: the busy state is the subject.
    selectPlanMutateAsync.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('plan-pln_pro'));

    const pressed = screen.getByTestId('plan-pln_pro');
    const other = screen.getByTestId('plan-pln_free');
    expect(pressed).toHaveAttribute('aria-busy', 'true');
    expect(pressed).toBeDisabled();
    expect(pressed.querySelector('.animate-spin')).not.toBeNull();
    // The others are held, but they are not the thing that is happening.
    expect(other).toBeDisabled();
    expect(other).not.toHaveAttribute('aria-busy', 'true');
    expect(other.querySelector('.animate-spin')).toBeNull();
  });

  it('says so when the payment step cannot be started', async () => {
    // The plan change SUCCEEDED and left the subscription `incomplete`; a
    // failed payment-setup call used to be an unhandled rejection, leaving no
    // form and no message.
    stripe.enabled = true;
    useSubscriptionMock.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    selectPlanMutateAsync.mockResolvedValue({
      ...SUB,
      planId: 'pln_pro',
      status: 'incomplete',
    });
    getPaymentSetupMock.mockRejectedValue(new Error('stripe is down'));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('plan-pln_pro'));

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('billing-payment-card')).not.toBeInTheDocument();
    // And the grid is usable again — the failure is not a dead end.
    await waitFor(() => expect(screen.getByTestId('plan-pln_pro')).toBeEnabled());
  });

  it('leaves no unhandled rejection when the plan switch fails', async () => {
    // `void handlePlanSelect(...)` discarded a rethrown rejection.
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);

    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    selectPlanMutateAsync.mockRejectedValue(new Error('card declined'));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('plan-pln_pro'));
    await waitFor(() => expect(screen.getByTestId('plan-pln_pro')).toBeEnabled());
    await new Promise((resolve) => setTimeout(resolve, 20));

    process.off('unhandledRejection', onRejection);
    expect(rejections).toEqual([]);
  });

  it('contains a crash in the payment form to that card', async () => {
    // Stripe Elements is third-party and mounts an iframe: a throw in there
    // must cost the payment card, not the whole billing panel.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    stripe.enabled = true;
    stripe.crash = true;
    window.history.replaceState(
      {},
      '',
      '/organization/acme/dashboard?payment_intent_client_secret=pi_secret',
    );
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    expect(await screen.findByTestId('billing-payment-form-error')).toBeInTheDocument();
    // The rest of the panel is untouched.
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('contains a crash in the cancellation card to that card', async () => {
    // Ending a subscription is its own failure domain: a throw there must not
    // take the plan grid and the invoice history with it.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    stripe.cancellationCrashes = true;
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    expect(await screen.findByTestId('billing-cancellation-error')).toBeInTheDocument();
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
