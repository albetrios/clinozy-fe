import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BillingPlan, BillingSubscription } from '@/shared/api/billing-contracts.ts';

import { SEEDED_PLANS, subscriptionFixture } from './billing-plan.fixtures.ts';
import { BillingPlanChangeConfirm } from './BillingPlanChangeConfirm.tsx';
import { sortPlansForComparison } from './plan-comparison.ts';

const SORTED = sortPlansForComparison(SEEDED_PLANS);
const byId = (id: string) => SORTED.find((plan) => plan.id === id) as BillingPlan;

function renderConfirm(
  props: Partial<{
    target: BillingPlan | null;
    current: BillingPlan | null;
    subscription: BillingSubscription | null;
    paymentsEnabled: boolean;
    busy: boolean;
  }> = {},
) {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();
  render(
    <BillingPlanChangeConfirm
      target={props.target === undefined ? byId('pln_growth') : props.target}
      current={props.current === undefined ? byId('pln_starter') : props.current}
      sorted={SORTED}
      subscription={
        props.subscription === undefined ? subscriptionFixture() : props.subscription
      }
      billingCycle="monthly"
      paymentsEnabled={props.paymentsEnabled ?? true}
      busy={props.busy ?? false}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />,
  );
  return { onConfirm, onDismiss };
}

const dialog = () => screen.getByTestId('plan-change-confirm');

describe('BillingPlanChangeConfirm', () => {
  it('stays closed without a target', () => {
    renderConfirm({ target: null });
    expect(screen.queryByTestId('plan-change-confirm')).not.toBeInTheDocument();
  });

  describe('an upgrade', () => {
    it('shows from → to, the price and seats before and after, and what you get', () => {
      renderConfirm();
      expect(
        within(dialog()).getByRole('heading', { name: 'Upgrade to Growth' }),
      ).toBeVisible();
      expect(screen.getByTestId('plan-change-route')).toHaveTextContent('NowStarter');
      expect(screen.getByTestId('plan-change-route')).toHaveTextContent('NewGrowth');
      const summary = screen.getByTestId('plan-change-summary');
      expect(summary).toHaveTextContent('Price$10 → $30 / month');
      expect(summary).toHaveTextContent('Seats5 → 15');
      expect(screen.getByText('What you get')).toBeVisible();
      expect(screen.getByTestId('plan-change-gains')).toHaveTextContent('Up to 15 seats');
      expect(screen.queryByText('What you lose')).not.toBeInTheDocument();
    });

    it('puts the plans side by side, the arrow pointing to the new one', () => {
      renderConfirm();
      const route = screen.getByTestId('plan-change-route');
      // One chevron between the two chips, mirrored for right-to-left.
      expect(route.querySelectorAll('svg.rtl\\:-scale-x-100')).toHaveLength(1);
    });

    it('takes effect now, prorated on the next invoice', () => {
      renderConfirm();
      expect(screen.getByTestId('plan-change-when')).toHaveTextContent(
        'Right away. The difference for the rest of this billing period is prorated on your next invoice.',
      );
    });

    it('only says "right away" when nothing is billed through the provider', () => {
      renderConfirm({ subscription: subscriptionFixture({ provider: null }) });
      expect(screen.getByTestId('plan-change-when')).toHaveTextContent(
        'Right away. Your billing cycle stays the same.',
      );
    });

    it('runs from the button that repeats its name; Keep closes it', async () => {
      const user = userEvent.setup();
      const { onConfirm, onDismiss } = renderConfirm();
      expect(screen.getByTestId('plan-change-confirm-keep')).toHaveFocus();
      expect(screen.getByTestId('plan-change-confirm-keep')).toHaveTextContent(
        'Keep Starter',
      );
      await user.click(screen.getByTestId('plan-change-confirm-accept'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      await user.click(screen.getByTestId('plan-change-confirm-keep'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('holds Keep while the move runs', () => {
      renderConfirm({ busy: true });
      expect(screen.getByTestId('plan-change-confirm-keep')).toBeDisabled();
    });
  });

  describe('a downgrade', () => {
    it('lists what you lose — the seats you had, struck through — and gains nothing', () => {
      renderConfirm({
        target: byId('pln_growth'),
        current: byId('pln_pro'),
        subscription: subscriptionFixture({ planId: 'pln_pro', seatsTotal: 25 }),
      });
      expect(
        within(dialog()).getByRole('heading', { name: 'Switch to Growth' }),
      ).toBeVisible();
      expect(screen.getByText('What you lose')).toBeVisible();
      const losses = screen.getByTestId('plan-change-losses');
      expect(losses).toHaveTextContent(
        'Up to 25 seatsSingle sign-on (SSO)Priority support',
      );
      expect(within(losses).getAllByRole('listitem')[0]?.lastElementChild).toHaveClass(
        'line-through',
      );
      expect(screen.queryByText('What you get')).not.toBeInTheDocument();
    });

    it('confirms on the same filled button as an upgrade', () => {
      renderConfirm({
        target: byId('pln_starter'),
        current: byId('pln_growth'),
        subscription: subscriptionFixture({ planId: 'pln_growth' }),
      });
      expect(screen.getByTestId('plan-change-confirm-accept')).toHaveAttribute(
        'data-variant',
        'default',
      );
    });

    it('says nothing else changes when only the price does', () => {
      const cheaper = {
        ...byId('pln_growth'),
        id: 'pln_lite',
        name: 'Lite',
        priceMonthly: 2000,
      };
      renderConfirm({
        target: cheaper,
        current: byId('pln_growth'),
        subscription: subscriptionFixture({ planId: 'pln_growth' }),
      });
      expect(screen.getByText('What you lose')).toBeVisible();
      expect(screen.getByText('Nothing else changes.')).toBeVisible();
    });

    it('names the members a smaller plan cannot seat', () => {
      renderConfirm({
        target: byId('pln_starter'),
        current: byId('pln_growth'),
        subscription: subscriptionFixture({ planId: 'pln_growth', seatsUsed: 9 }),
      });
      expect(screen.getByTestId('plan-change-seat-warning')).toHaveTextContent(
        '9 seats are taken, pending invitations included, and Starter includes 5. Up to 4 of the most recently joined members, never owners, will be suspended until seats free up.',
      );
    });

    it('says nothing of seats when everyone fits', () => {
      renderConfirm({
        target: byId('pln_starter'),
        current: byId('pln_growth'),
        subscription: subscriptionFixture({ planId: 'pln_growth', seatsUsed: 3 }),
      });
      expect(screen.queryByTestId('plan-change-seat-warning')).not.toBeInTheDocument();
    });
  });

  it('ends the paid plan at the end of its period when moving to Free', () => {
    renderConfirm({ target: byId('pln_free') });
    expect(
      within(dialog()).getByRole('heading', { name: 'Switch to Free' }),
    ).toBeVisible();
    expect(screen.getByTestId('plan-change-when').textContent).toMatch(
      /^Your Starter plan stays until .+\. After that the workspace is on Free\.$/,
    );
  });

  describe('a first plan', () => {
    it('starts from Free as an upgrade, with the card confirmed next', () => {
      renderConfirm({
        current: byId('pln_free'),
        subscription: null,
        target: byId('pln_starter'),
      });
      expect(
        within(dialog()).getByRole('heading', { name: 'Upgrade to Starter' }),
      ).toBeVisible();
      expect(screen.getByTestId('plan-change-when')).toHaveTextContent(
        'Right away — you confirm your payment method next.',
      );
      expect(screen.getByTestId('plan-change-confirm-keep')).toHaveTextContent(
        'Keep Free',
      );
    });

    it('is a choice when there is no plan at all, and no payment step without payments', () => {
      renderConfirm({
        current: null,
        subscription: null,
        target: byId('pln_starter'),
        paymentsEnabled: false,
      });
      expect(
        within(dialog()).getByRole('heading', { name: 'Choose Starter' }),
      ).toBeVisible();
      expect(screen.getByTestId('plan-change-when')).toHaveTextContent('Right away.');
      expect(screen.getByTestId('plan-change-confirm-keep')).toHaveTextContent('Not now');
    });
  });
});
