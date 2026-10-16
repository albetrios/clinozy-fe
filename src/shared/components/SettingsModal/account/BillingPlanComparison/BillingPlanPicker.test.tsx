import { screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SEEDED_PLANS, subscriptionFixture } from './billing-plan.fixtures.ts';
import { BillingPlanPicker } from './BillingPlanPicker.tsx';

function renderPicker(props: Partial<{ open: boolean; cycleSwitch: boolean }> = {}) {
  const onClose = vi.fn();
  const onChoose = vi.fn();
  // The drawer's dirty guard blocks navigation, so it renders under a router.
  const view = renderWithProviders(
    <>
      <span data-testid="plan-picker-probe" />
      <BillingPlanPicker
        open={props.open ?? true}
        onClose={onClose}
        plans={SEEDED_PLANS}
        subscription={subscriptionFixture()}
        canManage
        billingCycle="monthly"
        cycleSwitch={props.cycleSwitch ? <div data-testid="the-switch" /> : undefined}
        pendingPlanId={null}
        onChoose={onChoose}
      />
    </>,
  );
  return { ...view, onClose, onChoose };
}

describe('BillingPlanPicker', () => {
  it('opens as a drawer named Plans, with every plan and the comparison', async () => {
    renderPicker();
    const drawer = await screen.findByTestId('billing-plan-picker');
    expect(within(drawer).getByRole('heading', { name: 'Plans' })).toBeVisible();
    expect(within(drawer).getByTestId('plan-options')).toBeVisible();
    expect(within(drawer).getAllByRole('article')).toHaveLength(4);
    expect(within(drawer).getByTestId('plan-compare-table')).toBeVisible();
  });

  it('pads its content, not its scroll box, so the table head can pin flush', async () => {
    renderPicker();
    expect(await screen.findByTestId('billing-plan-picker-body')).not.toHaveClass(
      'p-(--drawer-body-pad)',
    );
    expect(
      screen.getByTestId('plan-options').closest('.p-\\(--drawer-body-pad\\)'),
    ).not.toBeNull();
  });

  it('draws nothing while closed', async () => {
    renderPicker({ open: false });
    expect(await screen.findByTestId('plan-picker-probe')).toBeInTheDocument();
    expect(screen.queryByTestId('billing-plan-picker')).not.toBeInTheDocument();
  });

  it('carries the cycle switch above the plans when it is given one', async () => {
    renderPicker({ cycleSwitch: true });
    expect(await screen.findByTestId('the-switch')).toBeInTheDocument();
  });

  it('hands a card press to the confirm, and Back closes it', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { onChoose, onClose } = renderPicker();
    await user.click(await screen.findByTestId('plan-pln_pro'));
    expect(onChoose).toHaveBeenCalledWith('pln_pro');
    await user.click(screen.getByTestId('billing-plan-picker-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { baseElement } = renderPicker();
    await screen.findByTestId('billing-plan-picker');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
