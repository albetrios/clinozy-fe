import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BillingPlan } from '@/shared/api/billing-contracts.ts';

import { BillingPlanComparison } from './BillingPlanComparison.tsx';

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

/** clinozy-be's seeded catalog, deliberately out of price order. */
const PLANS: BillingPlan[] = [
  plan({
    id: 'pln_pro',
    name: 'Pro',
    priceMonthly: 9900,
    priceYearly: 99000,
    seatLimit: 25,
    features: { priority_support: true, audit_log: true, sso: true },
  }),
  plan({ id: 'pln_free', name: 'Free', features: { audit_log: false } }),
  plan({
    id: 'pln_starter',
    name: 'Starter',
    priceMonthly: 1000,
    priceYearly: 10000,
    seatLimit: 5,
    features: { audit_log: true, brand_new_capability: true },
  }),
];

function renderComparison(
  props: Partial<{
    currentPlanId: string | null;
    hasSubscription: boolean;
    plans: BillingPlan[];
  }> = {},
) {
  const onSelect = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <BillingPlanComparison
      plans={props.plans ?? PLANS}
      currentPlanId={props.currentPlanId ?? null}
      hasSubscription={props.hasSubscription ?? false}
      canManage
      billingCycle="monthly"
      pendingPlanId={null}
      onSelect={onSelect}
    />,
  );
  return { ...view, onSelect };
}

describe('BillingPlanComparison', () => {
  it('orders the cards cheapest first', () => {
    renderComparison();
    const names = within(screen.getByTestId('plan-options'))
      .getAllByRole('heading', { level: 4 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(['Free', 'Starter', 'Pro']);
  });

  it('builds each tier on the one before it, in price order', () => {
    renderComparison();
    expect(screen.getByTestId('plan-card-pln_starter')).toHaveTextContent(
      'Everything in Free, plus:',
    );
    expect(screen.getByTestId('plan-card-pln_pro')).toHaveTextContent(
      'Everything in Starter, plus:',
    );
    // Audit log is Starter's already; an unknown key is never shown raw.
    expect(
      within(screen.getByTestId('plan-highlights-pln_pro'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Up to 25 seats', 'Single sign-on (SSO)', 'Priority support']);
    expect(screen.queryByText(/brand_new_capability/)).not.toBeInTheDocument();
  });

  it('labels upgrades and switches against the current plan', () => {
    renderComparison({ currentPlanId: 'pln_starter', hasSubscription: true });
    expect(screen.getByTestId('plan-current')).toHaveTextContent('Current plan');
    expect(screen.getByTestId('plan-pln_pro')).toHaveTextContent('Upgrade to Pro');
    expect(screen.getByTestId('plan-pln_free')).toHaveTextContent('Switch to Free');
  });

  it('passes the pressed plan up', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderComparison();
    await user.click(screen.getByTestId('plan-pln_pro'));
    expect(onSelect).toHaveBeenCalledWith('pln_pro');
  });

  it('sits two by two, and in one row once its box is wide enough', () => {
    renderComparison({
      plans: [...PLANS, plan({ id: 'pln_growth', name: 'Growth', priceMonthly: 3000 })],
    });
    expect(screen.getByTestId('plan-options')).toHaveClass(
      '@lg:grid-cols-2',
      '@4xl:grid-cols-4',
    );
  });

  it('opens every plan side by side behind "Compare all features"', async () => {
    const user = userEvent.setup();
    renderComparison();
    const toggle = screen.getByTestId('plan-compare-toggle');
    const table = screen.getByTestId('plan-compare-table');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', table.id);
    expect(table).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(table).toBeVisible();

    await user.click(toggle);
    expect(table).not.toBeVisible();
  });

  it('has no comparison to open with a single plan', () => {
    renderComparison({ plans: [PLANS[1] as BillingPlan] });
    expect(screen.queryByTestId('plan-compare-toggle')).not.toBeInTheDocument();
  });

  it('has no axe violations with the table open', async () => {
    const user = userEvent.setup();
    const { container } = renderComparison({
      currentPlanId: 'pln_starter',
      hasSubscription: true,
    });
    await user.click(screen.getByTestId('plan-compare-toggle'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
