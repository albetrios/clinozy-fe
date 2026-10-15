import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';

import { SEEDED_PLANS, subscriptionFixture } from './billing-plan.fixtures.ts';
import { BillingCurrentPlan } from './BillingCurrentPlan.tsx';

function renderCard(
  props: Partial<{
    plans: readonly BillingPlan[];
    subscription: BillingSubscription | null;
    canManage: boolean;
  }> = {},
) {
  const onCompare = vi.fn();
  const onUpgrade = vi.fn();
  const view = render(
    <BillingCurrentPlan
      plans={props.plans ?? SEEDED_PLANS}
      subscription={
        props.subscription === undefined ? subscriptionFixture() : props.subscription
      }
      canManage={props.canManage ?? true}
      onCompare={onCompare}
      onUpgrade={onUpgrade}
    />,
  );
  return { ...view, onCompare, onUpgrade, card: screen.getByTestId('billing-summary') };
}

describe('BillingCurrentPlan', () => {
  it('shows the plan, its status, price and cycle, seats and renewal', () => {
    const { card } = renderCard();
    expect(screen.getByRole('heading', { name: 'Starter plan' })).toBeVisible();
    expect(card).toHaveTextContent('Your plan');
    expect(card).toHaveTextContent('active');
    expect(card).toHaveTextContent('$10/ month· Billed monthly');
    expect(card).toHaveTextContent(/1 of 5 seats used · renews /);
    expect(screen.getByTestId('billing-seat-meter')).toHaveAttribute(
      'aria-label',
      'Seats',
    );
  });

  it('lists what the plan includes', () => {
    renderCard();
    expect(screen.getByTestId('billing-current-plan-includes')).toHaveTextContent(
      'Up to 5 seatsAudit log',
    );
  });

  it('opens the picker and offers the next plan up', async () => {
    const user = userEvent.setup();
    const { onCompare, onUpgrade } = renderCard();
    await user.click(screen.getByTestId('billing-compare-plans'));
    expect(onCompare).toHaveBeenCalled();
    expect(screen.getByTestId('billing-upgrade-next')).toHaveTextContent(
      'Upgrade to Growth',
    );
    await user.click(screen.getByTestId('billing-upgrade-next'));
    expect(onUpgrade).toHaveBeenCalledWith('pln_growth');
  });

  it('has no upgrade on the top plan, and none for a member who may not manage billing', () => {
    renderCard({ subscription: subscriptionFixture({ planId: 'pln_pro' }) });
    expect(screen.queryByTestId('billing-upgrade-next')).not.toBeInTheDocument();
  });

  it('lets a member who may not manage billing compare, not upgrade', () => {
    renderCard({ canManage: false });
    expect(screen.getByTestId('billing-compare-plans')).toBeInTheDocument();
    expect(screen.queryByTestId('billing-upgrade-next')).not.toBeInTheDocument();
  });

  it('is Free with no subscription', () => {
    const { card } = renderCard({ subscription: null });
    expect(screen.getByRole('heading', { name: 'Free plan' })).toBeVisible();
    expect(card).toHaveTextContent('$0/ month· Free for ever');
    expect(screen.queryByTestId('billing-seat-meter')).not.toBeInTheDocument();
    expect(screen.getByTestId('billing-upgrade-next')).toHaveTextContent(
      'Upgrade to Starter',
    );
  });

  it('says there is no plan when even the cheapest has a price', () => {
    renderCard({
      subscription: null,
      plans: SEEDED_PLANS.filter((plan) => plan.id !== 'pln_free'),
    });
    expect(screen.getByRole('heading', { name: 'No plan' })).toBeVisible();
    expect(screen.queryByTestId('billing-current-plan-includes')).not.toBeInTheDocument();
  });

  it('states an unlimited plan as ∞ seats, with no meter', () => {
    const { card } = renderCard({
      subscription: subscriptionFixture({ seatsTotal: null, seatsUsed: 7 }),
    });
    expect(card).toHaveTextContent(/7 of ∞ seats used/);
    expect(screen.queryByTestId('billing-seat-meter')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderCard();
    expect(await axe(container)).toHaveNoViolations();
  });
});
