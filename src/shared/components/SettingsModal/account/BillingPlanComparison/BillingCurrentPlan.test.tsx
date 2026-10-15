import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';

import { SEEDED_PLANS, subscriptionFixture } from './billing-plan.fixtures.ts';
import { BillingCurrentPlan } from './BillingCurrentPlan.tsx';

function renderHeader(
  props: Partial<{
    plans: readonly BillingPlan[];
    subscription: BillingSubscription | null;
    canManage: boolean;
  }> = {},
) {
  const onOpenPlans = vi.fn();
  const view = render(
    <BillingCurrentPlan
      plans={props.plans ?? SEEDED_PLANS}
      subscription={
        props.subscription === undefined ? subscriptionFixture() : props.subscription
      }
      canManage={props.canManage ?? true}
      onOpenPlans={onOpenPlans}
    />,
  );
  return {
    ...view,
    onOpenPlans,
    header: screen.getByTestId('billing-summary'),
    line: screen.getByTestId('billing-plan-line'),
    button: screen.getByTestId('billing-adjust-plan'),
  };
}

describe('BillingCurrentPlan', () => {
  it('names the plan on one line, with its price and the seats used', () => {
    const { line } = renderHeader();
    expect(screen.getByRole('heading', { name: 'Starter plan' })).toBeVisible();
    expect(line).toHaveTextContent('$10 / month · 1 of 5 seats used');
  });

  it('has one button — "Adjust plan" on a paid plan — that opens the plans', async () => {
    const user = userEvent.setup();
    const { header, button, onOpenPlans } = renderHeader();
    expect(header.querySelectorAll('button')).toHaveLength(1);
    expect(button).toHaveTextContent('Adjust plan');
    expect(button).toHaveAttribute('data-variant', 'outline');
    await user.click(button);
    expect(onOpenPlans).toHaveBeenCalledTimes(1);
  });

  it('is Free with no subscription, and invites an upgrade', () => {
    const { line, button } = renderHeader({ subscription: null });
    expect(screen.getByRole('heading', { name: 'Free plan' })).toBeVisible();
    expect(line).toHaveTextContent('Free for ever · 1 seat');
    expect(button).toHaveTextContent('Upgrade plan');
    expect(button).toHaveAttribute('data-variant', 'default');
  });

  it('lets a member who may not manage billing view the plans, not adjust them', () => {
    const { button } = renderHeader({ canManage: false });
    expect(button).toHaveTextContent('View plans');
  });

  it('says there is no plan when even the cheapest has a price', () => {
    const { line, button } = renderHeader({
      subscription: null,
      plans: SEEDED_PLANS.filter((plan) => plan.id !== 'pln_free'),
    });
    expect(screen.getByRole('heading', { name: 'No plan' })).toBeVisible();
    expect(line).toHaveTextContent('Choose a plan to get started.');
    expect(button).toHaveTextContent('View plans');
  });

  it('prices a yearly plan per month and says it is billed yearly', () => {
    const { line } = renderHeader({
      subscription: subscriptionFixture({ planId: 'pln_growth', billingCycle: 'yearly' }),
    });
    expect(line).toHaveTextContent('$25 / month · billed yearly · 1 of 5 seats used');
  });

  it('states an unlimited plan as no limit', () => {
    const { line } = renderHeader({
      subscription: subscriptionFixture({ seatsTotal: null, seatsUsed: 7 }),
    });
    expect(line).toHaveTextContent('7 seats used · no limit');
  });

  it('shows the status only when it needs attention', () => {
    const { unmount } = renderHeader();
    expect(screen.queryByTestId('billing-status')).not.toBeInTheDocument();
    unmount();
    renderHeader({ subscription: subscriptionFixture({ status: 'past_due' }) });
    expect(screen.getByTestId('billing-status')).toHaveTextContent('past due');
  });

  it('has no axe violations', async () => {
    const { container } = renderHeader();
    expect(await axe(container)).toHaveNoViolations();
  });
});
