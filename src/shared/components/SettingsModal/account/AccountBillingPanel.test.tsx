import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

const {
  useSubscriptionMock,
  useBillingPlansMock,
  selectPlanMutateAsync,
  useSelectBillingPlanMock,
  cancelMutateAsync,
  navigateMock,
  getPaymentSetupMock,
  notifyErrorMock,
  stripe,
} = vi.hoisted(() => ({
  useSubscriptionMock: vi.fn(),
  useBillingPlansMock: vi.fn(),
  selectPlanMutateAsync: vi.fn(),
  useSelectBillingPlanMock: vi.fn(),
  cancelMutateAsync: vi.fn(),
  navigateMock: vi.fn(),
  getPaymentSetupMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  /** Per-test Stripe switch — the payment step only exists when it is on. */
  stripe: { enabled: false, crash: false, cancellationCrashes: false },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  // The plan picker is a drawer, whose unsaved-changes guard asks the router.
  useBlocker: () => ({ proceed: vi.fn(), reset: vi.fn(), status: 'idle' }),
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
  useCancelSubscription: () => ({
    mutate: vi.fn(),
    mutateAsync: cancelMutateAsync,
    isPending: false,
  }),
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
    id: 'pln_plus',
    name: 'Plus',
    description: 'For small teams.',
    priceMonthly: 2900,
    priceYearly: 29000,
    currency: 'usd',
    isActive: true,
    seatLimit: 5,
    features: { audit_log: true },
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

/** Radix holds `pointer-events: none` on the page under a dialog; the checks are the subject elsewhere. */
function setupUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** The plan header's one button ("Adjust plan", "Upgrade plan", "View plans") opens the picker. */
async function openPicker(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId('billing-adjust-plan'));
  return screen.findByTestId('billing-plan-picker');
}

/** A card press in the picker opens its confirm; the confirm's button runs the move. */
async function chooseAndConfirm(user: ReturnType<typeof setupUser>, planId: string) {
  await openPicker(user);
  await user.click(screen.getByTestId(`plan-${planId}`));
  const confirm = await screen.findByTestId('plan-change-confirm');
  await user.click(within(confirm).getByTestId('plan-change-confirm-accept'));
  return confirm;
}

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
  it('still renders the plans when the subscription may not be read', async () => {
    useSubscriptionMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: false,
      isError: false,
      fetchStatus: 'idle' as const,
    });
    const user = setupUser();
    renderPanel();
    expect(screen.queryByTestId('query-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    await openPicker(user);
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
  });

  it('opens on the plan, and the plans side by side behind its one button', async () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const user = setupUser();
    renderPanel();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-options')).not.toBeInTheDocument();
    const picker = await openPicker(user);
    expect(within(picker).getByTestId('plan-options')).toBeInTheDocument();
    expect(within(picker).getByTestId('plan-pln_pro')).toBeInTheDocument();
    expect(within(picker).getByTestId('plan-compare-table')).toBeInTheDocument();
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
    ])('is on Free, and upgrades off it, when sub is %s', async (_label, value) => {
      useSubscriptionMock.mockReturnValue({
        data: value,
        isPending: false,
        isLoading: false,
        isError: false,
      });
      setCanManage(true);
      const user = setupUser();
      renderPanel();

      expect(screen.getByRole('heading', { name: 'Free plan' })).toBeInTheDocument();
      await openPicker(user);
      expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
      expect(screen.queryByTestId('plan-pln_free')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-pln_pro')).toHaveTextContent('Upgrade to Pro');
      expect(screen.getByTestId('plan-options')).not.toHaveTextContent('Switch to');
    });

    it('reads "Choose", not "Switch to", when even the cheapest plan has a price', async () => {
      useBillingPlansMock.mockReturnValue({
        data: PLANS.filter((plan) => plan.id !== 'pln_free'),
        isPending: false,
        isLoading: false,
        isError: false,
      });
      useSubscriptionMock.mockReturnValue({
        data: null,
        isPending: false,
        isLoading: false,
        isError: false,
      });
      setCanManage(true);
      const user = setupUser();
      renderPanel();

      expect(screen.getByRole('heading', { name: 'No plan' })).toBeInTheDocument();
      await openPicker(user);
      expect(screen.getByTestId('plan-pln_pro')).toHaveTextContent('Choose Pro');
      expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-options')).not.toHaveTextContent('Switch to');
    });
  });

  it('marks the subscribed plan as current and offers an upgrade off it', async () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const user = setupUser();
    renderPanel();

    // The plan the subscription names is identified in two places at once: the
    // summary heading and its own card, whose button is a disabled "Current plan".
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    await openPicker(user);
    expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
    expect(screen.getByTestId('plan-current')).toBeDisabled();
    expect(screen.queryByTestId('plan-pln_free')).not.toBeInTheDocument();
    // Pro costs more than Free: the button says it is an upgrade.
    expect(screen.getByTestId('plan-pln_pro')).toHaveTextContent('Upgrade to Pro');
  });

  it('offers a switch, not an upgrade, to a cheaper plan', async () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, planId: 'pln_pro' },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const user = setupUser();
    renderPanel();
    await openPicker(user);

    expect(screen.getByTestId('plan-pln_plus')).toHaveTextContent('Switch to Plus');
    expect(screen.getByTestId('plan-pln_free')).toHaveTextContent('Switch to Free');
    expect(screen.queryByTestId('plan-pln_pro')).not.toBeInTheDocument();
  });

  it('draws the current plan with the ink edge', async () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const user = setupUser();
    renderPanel();
    await openPicker(user);

    const current = screen.getByText('Current plan').closest('[data-current]');
    expect(current).toHaveClass('border-foreground', 'ring-1');
  });

  it('offers the cycle on a segmented track before there is a subscription', async () => {
    const user = setupUser();
    useSubscriptionMock.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();
    await openPicker(user);

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

    it('hides the cycle switch and prices every card on the subscription cycle', async () => {
      useSubscriptionMock.mockReturnValue({
        data: YEARLY_SUB,
        isPending: false,
        isLoading: false,
        isError: false,
      });
      setCanManage(true);
      const user = setupUser();
      renderPanel();

      expect(screen.getByTestId('billing-plan-line')).toHaveTextContent('billed yearly');
      await openPicker(user);
      expect(screen.queryByTestId('billing-cycle-toggle')).not.toBeInTheDocument();
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
      const user = setupUser();
      renderPanel();

      await chooseAndConfirm(user, 'pln_pro');
      expect(selectPlanMutateAsync).toHaveBeenCalledWith({
        planId: 'pln_pro',
        billingCycle: 'yearly',
      });
    });
  });

  it('switches plan when allowed — only from the confirm, then back to Billing', async () => {
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
    const user = setupUser();
    renderPanel();
    await openPicker(user);
    await user.click(screen.getByTestId('plan-pln_pro'));
    // A card press opens the confirm; nothing has changed yet.
    expect(await screen.findByTestId('plan-change-confirm')).toBeInTheDocument();
    expect(selectPlanMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('plan-change-confirm-accept'));
    expect(selectPlanMutateAsync).toHaveBeenCalledWith({
      planId: 'pln_pro',
      billingCycle: 'monthly',
    });
    await waitFor(() =>
      expect(screen.queryByTestId('plan-change-confirm')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('billing-plan-picker')).not.toBeInTheDocument(),
    );
  });

  it('names its one button for the plan: Adjust on a paid plan, Upgrade on Free', () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, planId: 'pln_plus' },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const { unmount } = renderPanel();
    expect(screen.getByTestId('billing-adjust-plan')).toHaveTextContent('Adjust plan');
    unmount();

    useSubscriptionMock.mockReturnValue({
      data: null,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    renderPanel();
    expect(screen.getByTestId('billing-adjust-plan')).toHaveTextContent('Upgrade plan');
    // No second, competing button: the picker is where a plan is chosen.
    expect(screen.getByTestId('billing-summary').querySelectorAll('button')).toHaveLength(
      1,
    );
  });

  it('says when the plan renews under it, and offers Resubscribe once it is set to end', () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, cancelAtPeriodEnd: true },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();
    expect(screen.getByTestId('billing-notice')).toHaveTextContent(
      'Your subscription will be canceled on Dec 1, 2026.',
    );
    expect(screen.getByTestId('billing-resubscribe')).toBeInTheDocument();
  });

  it('changes nothing when the confirm is kept', async () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    const user = setupUser();
    renderPanel();
    await openPicker(user);
    await user.click(screen.getByTestId('plan-pln_pro'));
    await user.click(await screen.findByTestId('plan-change-confirm-keep'));

    await waitFor(() =>
      expect(screen.queryByTestId('plan-change-confirm')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('billing-plan-picker')).toBeInTheDocument();
    expect(selectPlanMutateAsync).not.toHaveBeenCalled();
  });

  it('moves to Free by ending the paid plan at the end of its period', async () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, planId: 'pln_pro' },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    cancelMutateAsync.mockResolvedValue({ ...SUB, cancelAtPeriodEnd: true });
    const user = setupUser();
    renderPanel();

    await chooseAndConfirm(user, 'pln_free');
    expect(cancelMutateAsync).toHaveBeenCalledWith('sub_test');
    expect(selectPlanMutateAsync).not.toHaveBeenCalled();
  });

  it('hides plan-switch controls without the billing permission', async () => {
    useSubscriptionMock.mockReturnValue({
      data: SUB,
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(false);
    const user = setupUser();
    renderPanel();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    expect(screen.getByTestId('billing-adjust-plan')).toHaveTextContent('View plans');
    // Comparing is reading — anyone may; changing is not.
    await openPicker(user);
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-pln_pro')).not.toBeInTheDocument();
  });

  // Plan changes are a team-workspace act: a personal workspace that somehow holds
  // subscription:manage still gets no plan buttons and no cycle switch.
  it('offers no plan changes in a personal workspace, even with subscription:manage', async () => {
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
    const user = setupUser();
    renderPanel();

    expect(screen.getByTestId('billing-adjust-plan')).toHaveTextContent('View plans');
    await openPicker(user);
    expect(screen.getByTestId('plan-options')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-pln_pro')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-cycle-toggle')).not.toBeInTheDocument();
  });

  it('states the seats used out of the plan seats on the plan line', () => {
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

  it('states an unlimited plan as no limit', () => {
    useSubscriptionMock.mockReturnValue({
      data: { ...SUB, seatsTotal: null, seatsUsed: 4 },
      isPending: false,
      isLoading: false,
      isError: false,
    });
    setCanManage(true);
    renderPanel();

    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      '4 seats used · no limit',
    );
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
    const user = setupUser();
    renderPanel();

    await chooseAndConfirm(user, 'pln_pro');

    // The confirm says the move is running, and cannot be left half-way.
    expect(screen.getByTestId('plan-change-confirm-accept')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByTestId('plan-change-confirm-keep')).toBeDisabled();
    const pressed = screen.getByTestId('plan-pln_pro');
    const other = screen.getByTestId('plan-pln_plus');
    expect(pressed).toHaveAttribute('aria-busy', 'true');
    expect(pressed).toBeDisabled();
    expect(pressed.querySelector('[data-slot="spinner"]')).not.toBeNull();
    // The others are held, but they are not the thing that is happening.
    expect(other).toBeDisabled();
    expect(other).not.toHaveAttribute('aria-busy', 'true');
    expect(other.querySelector('[data-slot="spinner"]')).toBeNull();
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
    const user = setupUser();
    renderPanel();

    await chooseAndConfirm(user, 'pln_pro');

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('billing-payment-card')).not.toBeInTheDocument();
    // The plan change went through, so the confirm closes — the failure is not a dead end.
    await waitFor(() =>
      expect(screen.queryByTestId('plan-change-confirm')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('billing-adjust-plan')).toBeEnabled();
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
    const user = setupUser();
    renderPanel();

    await chooseAndConfirm(user, 'pln_pro');
    // The move failed: the confirm stays, ready for another try or Keep.
    await waitFor(() =>
      expect(screen.getByTestId('plan-change-confirm-accept')).toBeEnabled(),
    );
    expect(screen.getByTestId('plan-pln_pro')).toBeEnabled();
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
    expect(screen.getByTestId('billing-adjust-plan')).toBeInTheDocument();
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
    expect(screen.getByTestId('billing-adjust-plan')).toBeInTheDocument();
    expect(screen.getByTestId('billing-summary')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
