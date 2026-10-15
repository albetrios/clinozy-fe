import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';

import { SEEDED_PLANS, subscriptionFixture } from './billing-plan.fixtures.ts';
import { BillingPlanComparison } from './BillingPlanComparison.tsx';

function renderComparison(
  props: Partial<{
    plans: readonly BillingPlan[];
    subscription: BillingSubscription | null;
    canManage: boolean;
    pendingPlanId: string | null;
  }> = {},
) {
  const onChoose = vi.fn();
  const view = render(
    <BillingPlanComparison
      plans={props.plans ?? SEEDED_PLANS}
      subscription={props.subscription ?? null}
      canManage={props.canManage ?? true}
      billingCycle="monthly"
      pendingPlanId={props.pendingPlanId ?? null}
      onChoose={onChoose}
    />,
  );
  return { ...view, onChoose };
}

const buttonOf = (planId: string) => screen.getByTestId(`plan-${planId}`);

describe('BillingPlanComparison', () => {
  it('puts every plan in one row, cheapest first', () => {
    renderComparison();
    const row = screen.getByTestId('plan-options');
    expect(row).toHaveClass('@xl:grid-cols-2', '@3xl:grid-cols-4');
    expect(
      within(row)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Free', 'Starter', 'Growth', 'Pro']);
  });

  it('builds each tier on the one before it', () => {
    renderComparison();
    expect(screen.getByTestId('plan-card-pln_pro')).toHaveTextContent(
      'Everything in Growth, plus:',
    );
    expect(
      within(screen.getByTestId('plan-highlights-pln_pro'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Up to 25 seats', 'Single sign-on (SSO)', 'Priority support']);
  });

  describe('with no subscription, the workspace is on Free', () => {
    it('marks Free current and offers the rest as upgrades', () => {
      renderComparison();
      expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
      expect(screen.queryByTestId('plan-pln_free')).not.toBeInTheDocument();
      expect(buttonOf('pln_starter')).toHaveTextContent('Upgrade to Starter');
      expect(screen.getByTestId('plan-next-pln_starter')).toHaveTextContent(
        'Next step up',
      );
    });

    it('reads "Choose" when even the cheapest plan has a price', () => {
      renderComparison({ plans: SEEDED_PLANS.filter((plan) => plan.id !== 'pln_free') });
      expect(screen.queryByTestId('plan-current')).not.toBeInTheDocument();
      expect(buttonOf('pln_starter')).toHaveTextContent('Choose Starter');
    });
  });

  describe('with a subscription', () => {
    it('upgrades to dearer plans, switches to cheaper ones and to Free', () => {
      renderComparison({ subscription: subscriptionFixture({ planId: 'pln_growth' }) });
      expect(screen.getByTestId('plan-card-pln_growth')).toHaveAttribute(
        'data-current',
        'true',
      );
      expect(buttonOf('pln_pro')).toHaveTextContent('Upgrade to Pro');
      expect(buttonOf('pln_starter')).toHaveTextContent('Switch to Starter');
      expect(buttonOf('pln_free')).toHaveTextContent('Switch to Free');
      expect(screen.getByTestId('plan-next-pln_pro')).toBeInTheDocument();
    });

    it('reads "Free from <date>" once the paid plan is set to end', () => {
      renderComparison({
        subscription: subscriptionFixture({ cancelAtPeriodEnd: true }),
      });
      expect(screen.getByTestId('plan-free-from-pln_free')).toBeDisabled();
    });

    it('holds every button while one move runs', () => {
      renderComparison({ subscription: subscriptionFixture(), pendingPlanId: 'pln_pro' });
      expect(buttonOf('pln_pro')).toHaveTextContent('Switching…');
      expect(buttonOf('pln_growth')).toBeDisabled();
    });
  });

  it('shows prices but no buttons to a member who may not manage billing', () => {
    renderComparison({ canManage: false, subscription: subscriptionFixture() });
    expect(screen.queryAllByTestId(/^plan-pln_/)).toEqual([]);
    expect(screen.getByTestId('plan-current')).toBeInTheDocument();
  });

  it('passes the pressed plan up — to its confirm', async () => {
    const user = userEvent.setup();
    const { onChoose } = renderComparison();
    await user.click(buttonOf('pln_pro'));
    expect(onChoose).toHaveBeenCalledWith('pln_pro');
  });

  it('compares every plan under the cards, open', () => {
    renderComparison();
    expect(
      screen.getByRole('heading', { name: 'Compare features across plans' }),
    ).toBeVisible();
    expect(screen.getByTestId('plan-compare-table')).toBeVisible();
  });

  it('has no comparison with a single plan', () => {
    renderComparison({ plans: [SEEDED_PLANS[1] as BillingPlan] });
    expect(screen.queryByTestId('plan-compare-table')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderComparison({ subscription: subscriptionFixture() });
    expect(await axe(container)).toHaveNoViolations();
  });
});
