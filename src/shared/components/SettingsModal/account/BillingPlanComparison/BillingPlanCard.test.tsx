import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BillingCycle, BillingPlan } from '@/shared/api/billing-contracts.ts';

import { BillingPlanCard } from './BillingPlanCard.tsx';
import { planTiers } from './plan-comparison.ts';

function plan(
  overrides: Partial<BillingPlan> & Pick<BillingPlan, 'id' | 'name'>,
): BillingPlan {
  return {
    description: null,
    priceMonthly: 0,
    priceYearly: null,
    currency: 'usd',
    isActive: true,
    seatLimit: 1,
    features: {},
    ...overrides,
  };
}

const FREE = plan({ id: 'pln_free', name: 'Free' });
const STARTER = plan({
  id: 'pln_starter',
  name: 'Starter',
  priceMonthly: 1000,
  priceYearly: 10000,
  seatLimit: 5,
  features: { audit_log: true },
});

interface CardOptions {
  plans?: BillingPlan[];
  at?: number;
  billingCycle?: BillingCycle;
  current?: boolean;
  currentPriceMonthly?: number | null;
  hasSubscription?: boolean;
  canManage?: boolean;
  pendingPlanId?: string | null;
}

/** Renders the card of `plans[at]`, as the comparison would. */
function renderCard({
  plans = [FREE, STARTER],
  at = 1,
  billingCycle = 'monthly',
  current = false,
  currentPriceMonthly = null,
  hasSubscription = false,
  canManage = true,
  pendingPlanId = null,
}: CardOptions = {}) {
  const tier = planTiers(plans)[at];
  if (!tier) throw new Error(`no tier at ${at}`);
  const onSelect = vi.fn().mockResolvedValue(undefined);
  render(
    <BillingPlanCard
      tier={tier}
      billingCycle={billingCycle}
      current={current}
      currentPriceMonthly={currentPriceMonthly}
      hasSubscription={hasSubscription}
      canManage={canManage}
      pendingPlanId={pendingPlanId}
      onSelect={onSelect}
    />,
  );
  return { onSelect, card: screen.getByTestId(`plan-card-${tier.plan.id}`) };
}

describe('BillingPlanCard', () => {
  describe('the tagline', () => {
    it.each([
      [1, 'For one practitioner'],
      [5, 'For teams of up to 5'],
      [null, 'For teams of any size'],
    ])('reads %s seats as "%s" when the plan has no description', (seats, line) => {
      const { card } = renderCard({ plans: [{ ...STARTER, seatLimit: seats }], at: 0 });
      expect(card).toHaveTextContent(line);
    });

    it("keeps the plan's own description", () => {
      const { card } = renderCard({
        plans: [{ ...STARTER, description: 'For clinic groups.' }],
        at: 0,
      });
      expect(card).toHaveTextContent('For clinic groups.');
      expect(card).not.toHaveTextContent('For teams of up to 5');
    });
  });

  describe('the price', () => {
    it('reads a free plan as $0 a month, free for ever', () => {
      renderCard({ at: 0 });
      const price = screen.getByTestId('plan-price-pln_free');
      expect(price).toHaveTextContent('$0/ month');
      expect(price).toHaveTextContent('Free for ever');
    });

    it('reads monthly as a whole figure per month', () => {
      renderCard();
      const price = screen.getByTestId('plan-price-pln_starter');
      expect(price).toHaveTextContent('$10/ month');
      expect(price).toHaveTextContent('Billed monthly');
      expect(screen.queryByTestId('plan-savings-pln_starter')).not.toBeInTheDocument();
    });

    it('reads yearly per month too, with the yearly total and the saving', () => {
      renderCard({ billingCycle: 'yearly' });
      const price = screen.getByTestId('plan-price-pln_starter');
      expect(price).toHaveTextContent('$8.33/ month');
      expect(price).toHaveTextContent('Billed yearly · $100 a year');
      expect(screen.getByTestId('plan-savings-pln_starter')).toHaveTextContent(
        'Save 17%',
      );
    });

    it('says a plan without a yearly price is billed monthly only', () => {
      renderCard({
        plans: [{ ...STARTER, priceYearly: null }],
        at: 0,
        billingCycle: 'yearly',
      });
      expect(screen.getByTestId('plan-price-pln_starter')).toHaveTextContent(
        '$10/ monthBilled monthly — no yearly option',
      );
    });
  });

  describe('the checklist', () => {
    it('lists what the first plan includes', () => {
      const { card } = renderCard({ at: 0 });
      expect(card).toHaveTextContent('Includes:');
      expect(screen.getByTestId('plan-highlights-pln_free')).toHaveTextContent('1 seat');
    });

    it('lists only what a later plan adds, under "Everything in <previous>, plus:"', () => {
      const { card } = renderCard();
      expect(card).toHaveTextContent('Everything in Free, plus:');
      expect(screen.getByTestId('plan-highlights-pln_starter')).toHaveTextContent(
        'Up to 5 seatsAudit log',
      );
    });

    it('drops the "plus" and the list when a plan adds nothing', () => {
      const same = plan({
        id: 'pln_same',
        name: 'Same',
        priceMonthly: 2000,
        seatLimit: 1,
      });
      const { card } = renderCard({ plans: [FREE, same] });
      expect(card).toHaveTextContent('Everything in Free');
      expect(card).not.toHaveTextContent('plus:');
      expect(screen.queryByTestId('plan-highlights-pln_same')).not.toBeInTheDocument();
    });

    it('shows a capability value next to its name', () => {
      renderCard({
        plans: [FREE, { ...STARTER, features: { audit_log: 90 } }],
      });
      expect(screen.getByTestId('plan-highlights-pln_starter')).toHaveTextContent(
        'Audit log · 90',
      );
    });
  });

  describe('the action', () => {
    it('reads "Choose" before there is a subscription', async () => {
      const user = userEvent.setup();
      const { onSelect } = renderCard();
      await user.click(screen.getByTestId('plan-pln_starter'));
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent('Choose Starter');
      expect(onSelect).toHaveBeenCalledWith('pln_starter');
    });

    it('reads "Upgrade to" for a dearer plan', () => {
      renderCard({ hasSubscription: true, currentPriceMonthly: 0 });
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent(
        'Upgrade to Starter',
      );
    });

    it('reads "Switch to" on the quieter button for a cheaper plan', () => {
      renderCard({ at: 0, hasSubscription: true, currentPriceMonthly: 1000 });
      const button = screen.getByTestId('plan-pln_free');
      expect(button).toHaveTextContent('Switch to Free');
      expect(button).toHaveAttribute('data-variant', 'outline');
    });

    it('is a disabled "Current plan" on the plan the subscription is on', () => {
      const { card } = renderCard({ current: true, hasSubscription: true });
      expect(screen.getByTestId('plan-current')).toBeDisabled();
      expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
      expect(screen.queryByTestId('plan-pln_starter')).not.toBeInTheDocument();
      expect(card).toHaveAttribute('data-current', 'true');
      expect(card).toHaveClass('border-foreground', 'ring-1');
    });

    it('offers nothing to a member who may not manage billing, and still names the current plan', () => {
      renderCard({ canManage: false, current: true, hasSubscription: true });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('Current plan')).toBeInTheDocument();
    });

    it('spins the pressed plan and holds the others', () => {
      renderCard({ pendingPlanId: 'pln_starter' });
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent('Switching…');
    });

    it('holds a plan while another one switches', () => {
      renderCard({ pendingPlanId: 'pln_free' });
      expect(screen.getByTestId('plan-pln_starter')).toBeDisabled();
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent('Choose Starter');
    });
  });
});
