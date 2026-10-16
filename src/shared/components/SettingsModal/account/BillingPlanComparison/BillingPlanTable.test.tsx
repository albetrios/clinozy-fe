import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { BillingPlan } from '@/shared/api/billing-contracts.ts';

import { BillingPlanTable } from './BillingPlanTable.tsx';

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

const PLANS: BillingPlan[] = [
  plan({ id: 'pln_free', name: 'Free', features: { audit_log: false } }),
  plan({
    id: 'pln_starter',
    name: 'Starter',
    priceMonthly: 1000,
    priceYearly: 10000,
    seatLimit: 5,
    features: { audit_log: true },
  }),
  plan({
    id: 'pln_pro',
    name: 'Pro',
    priceMonthly: 9900,
    priceYearly: 99000,
    seatLimit: null,
    features: { audit_log: true, sso: true, priority_support: '24 h' },
  }),
];

function renderTable(
  props: Partial<{ plans: BillingPlan[]; currentPlanId: string | null }> = {},
) {
  const view = render(
    <BillingPlanTable
      plans={props.plans ?? PLANS}
      currentPlanId={props.currentPlanId ?? null}
    />,
  );
  const table = screen.getByRole('table', { name: 'Every plan, side by side' });
  return { ...view, table };
}

function rowCells(table: HTMLElement, name: RegExp): (string | null)[] {
  const row = within(table).getByRole('rowheader', { name }).closest('tr');
  if (!row) throw new Error(`no row for ${String(name)}`);
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

describe('BillingPlanTable', () => {
  it('heads a column per plan and marks the current one', () => {
    const { table } = renderTable({ currentPlanId: 'pln_starter' });
    const [head] = within(table).getAllByRole('rowgroup');
    if (!head) throw new Error('the table has no head');
    expect(
      within(head)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Free', 'StarterCurrent', 'Pro']);
    const current = within(head).getByRole('columnheader', { name: /Starter/ });
    expect(current).toHaveAttribute('data-current', 'true');
  });

  it('keeps its head row in view once the picker is wide enough', () => {
    const { table } = renderTable();
    const [head] = within(table).getAllByRole('rowgroup');
    if (!head) throw new Error('the table has no head');
    for (const header of within(head).getAllByRole('columnheader')) {
      expect(header).toHaveClass('sticky', 'top-0');
    }
    expect(screen.getByTestId('plan-compare-table')).toHaveClass('md:overflow-visible');
  });

  it('groups the rows as pricing, team and features', () => {
    const { table } = renderTable();
    const groups = within(table)
      .getAllByRole('columnheader')
      .filter((header) => header.getAttribute('scope') === 'colgroup')
      .map((header) => header.textContent);
    expect(groups).toEqual(['Pricing', 'Team', 'Features']);
  });

  it('explains each row in a line under its name', () => {
    const { table } = renderTable();
    expect(within(table).getByRole('rowheader', { name: /Audit log/ })).toHaveTextContent(
      'Audit logSee who changed what, and when.',
    );
  });

  it('prices each plan, with what yearly saves', () => {
    const { table } = renderTable();
    expect(rowCells(table, /Monthly price/)).toEqual(['$0', '$10', '$99']);
    expect(rowCells(table, /Yearly price/)).toEqual([
      'Not offered',
      '$100Save 17%',
      '$990Save 17%',
    ]);
  });

  it('counts the seats, unlimited in words', () => {
    const { table } = renderTable();
    expect(rowCells(table, /Seats included/)).toEqual(['1', '5', 'Unlimited']);
  });

  it('ticks a capability, dashes its absence, and shows a value as the value', () => {
    const { table } = renderTable();
    expect(rowCells(table, /Audit log/)).toEqual([
      'Not included',
      'Included',
      'Included',
    ]);
    expect(rowCells(table, /Single sign-on/)).toEqual([
      'Not included',
      'Not included',
      'Included',
    ]);
    expect(rowCells(table, /Priority support/)).toEqual([
      'Not included',
      'Not included',
      '24 h',
    ]);
  });

  it('leaves out the rows nobody offers', () => {
    const { table } = renderTable({
      plans: PLANS.slice(0, 2).map((p) => ({ ...p, priceYearly: null })),
    });
    expect(within(table).queryByRole('rowheader', { name: /Yearly price/ })).toBeNull();
    expect(within(table).queryByRole('rowheader', { name: /Single sign-on/ })).toBeNull();
    expect(
      within(table).getByRole('rowheader', { name: /Audit log/ }),
    ).toBeInTheDocument();
  });

  it('holds the row names in place while the plans scroll sideways', () => {
    const { table } = renderTable();
    expect(screen.getByTestId('plan-compare-table')).toHaveClass('overflow-x-auto');
    expect(within(table).getByRole('rowheader', { name: /Seats included/ })).toHaveClass(
      'sticky',
      'start-0',
    );
  });

  it('has no axe violations', async () => {
    const { container } = renderTable({ currentPlanId: 'pln_pro' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
