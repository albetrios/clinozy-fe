import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BillingCycle, BillingPlan } from '@/shared/api/billing-contracts.ts';

import { BillingPlanCard } from './BillingPlanCard.tsx';
import { type PlanCardAction, planTiers } from './plan-comparison.ts';

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
  action?: PlanCardAction;
  nextStepUp?: boolean;
  busy?: boolean;
  held?: boolean;
}

/** Renders the card of `plans[at]`, as the picker would. */
function renderCard({
  plans = [FREE, STARTER],
  at = 1,
  billingCycle = 'monthly',
  action = { kind: 'choose' },
  nextStepUp = false,
  busy = false,
  held = false,
}: CardOptions = {}) {
  const tier = planTiers(plans)[at];
  if (!tier) throw new Error(`no tier at ${at}`);
  const onAction = vi.fn();
  render(
    <BillingPlanCard
      tier={tier}
      rank={at}
      billingCycle={billingCycle}
      action={action}
      nextStepUp={nextStepUp}
      busy={busy}
      held={held}
      onAction={onAction}
    />,
  );
  return { onAction, card: screen.getByTestId(`plan-card-${tier.plan.id}`) };
}

describe('BillingPlanCard', () => {
  it('names the plan as an article heading', () => {
    renderCard();
    expect(screen.getByRole('article', { name: 'Starter' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Starter' }),
    ).toBeInTheDocument();
  });

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
      renderCard({ plans: [FREE, { ...STARTER, features: { audit_log: 90 } }] });
      expect(screen.getByTestId('plan-highlights-pln_starter')).toHaveTextContent(
        'Audit log · 90',
      );
    });
  });

  describe('the action', () => {
    it('opens the move it names — never the change itself', async () => {
      const user = userEvent.setup();
      const { onAction } = renderCard({ action: { kind: 'upgrade' } });
      const button = screen.getByTestId('plan-pln_starter');
      expect(button).toHaveTextContent('Upgrade to Starter');
      expect(button).toHaveAttribute('data-variant', 'default');
      await user.click(button);
      expect(onAction).toHaveBeenCalledWith('pln_starter');
    });

    it('reads "Choose" for a first plan and "Switch to" on the quieter button', () => {
      renderCard({ action: { kind: 'choose' } });
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent('Choose Starter');
    });

    it('reads "Switch to" on the quieter button', () => {
      renderCard({ at: 0, action: { kind: 'switch' } });
      const button = screen.getByTestId('plan-pln_free');
      expect(button).toHaveTextContent('Switch to Free');
      expect(button).toHaveAttribute('data-variant', 'outline');
    });

    it('is a disabled "Current plan" on the plan in force, with the ink edge', () => {
      const { card } = renderCard({ action: { kind: 'current' } });
      expect(screen.getByTestId('plan-current')).toBeDisabled();
      expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
      expect(screen.queryByTestId('plan-pln_starter')).not.toBeInTheDocument();
      expect(card).toHaveAttribute('data-current', 'true');
      expect(card).toHaveClass('border-foreground', 'ring-1');
    });

    it('reads "Free from <date>" once the paid plan is set to end', () => {
      renderCard({
        at: 0,
        action: { kind: 'freeFrom', date: '2026-12-01T00:00:00.000Z' },
      });
      const button = screen.getByTestId('plan-free-from-pln_free');
      expect(button).toBeDisabled();
      expect(button.textContent).toMatch(/^Free from /);
    });

    it('offers nothing to a member who may not manage billing', () => {
      renderCard({ action: { kind: 'none' } });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('spins the pressed plan', () => {
      renderCard({ busy: true, held: true });
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent('Switching…');
    });

    it('holds a plan while another one moves', () => {
      renderCard({ held: true });
      expect(screen.getByTestId('plan-pln_starter')).toBeDisabled();
      expect(screen.getByTestId('plan-pln_starter')).toHaveTextContent('Choose Starter');
    });
  });

  it('marks the plan above the current one as the next step up', () => {
    renderCard({ nextStepUp: true, action: { kind: 'upgrade' } });
    expect(screen.getByTestId('plan-next-pln_starter')).toHaveTextContent('Next step up');
  });
});
