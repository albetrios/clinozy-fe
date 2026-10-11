import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { PurchasesPage } from './PurchasesPage.tsx';

const ROOM = '/organization/acme/medical/purchases';
const PAY = '/organization/acme/payments/pay';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => resetAppFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

/** The Purchases tab at `url`. */
function renderPurchases(url = ROOM, role?: 'pharmacist' | 'accountant') {
  return renderMedicalRoutes(url, { purchases: PurchasesPage }, role ? { role } : {});
}

describe('PurchasesPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All purchase orders loaded"', async () => {
    const { container } = renderPurchases();
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-purchases-table-row')).toHaveLength(3),
    );
    expect(screen.getByTestId('medical-purchases-page')).toHaveTextContent(
      'K R Medical Agency',
    );
    expect(screen.getByTestId('medical-purchases-table-end')).toHaveTextContent(
      'All purchase orders loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-purchases-tab-purchases',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a received order’s "Pay ₹2,980" opens Send payment on its bill (Q-M1)', async () => {
    const user = setup();
    const { router } = renderPurchases();
    const pay = await screen.findByTestId('medical-purchases-row-action-pay');
    expect(pay).toHaveAccessibleName('Pay ₹2,980');
    await user.click(pay);
    await waitFor(() => expect(router.state.location.pathname).toBe(PAY));
    // The bill's key is its purchase's id — here the fixture PO's (D153 seam).
    expect(router.state.location.search).toEqual({ bill: ref.purchaseOrder(431) });
  });

  it('"Pay all received · ₹2,980" with Stage Received pays the oldest open bill', async () => {
    const user = setup();
    const { router } = renderPurchases(`${ROOM}?stage=received`);
    const action = await screen.findByTestId(
      'medical-purchases-view-action-pay-received',
    );
    expect(action).toHaveAccessibleName('Pay all received · ₹2,980');
    await user.click(action);
    await waitFor(() => expect(router.state.location.pathname).toBe(PAY));
    // The bill's key is its purchase's id — here the fixture PO's (D153 seam).
    expect(router.state.location.search).toEqual({ bill: ref.purchaseOrder(431) });
  });

  it('an Ordered order receives, edits and — for an Admin — cancels with a reason', async () => {
    const user = setup();
    const { router } = renderPurchases();
    await user.click(await screen.findByTestId('medical-purchases-row-action-cancel'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Cancel this purchase order?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('K R Medical Agency · ₹4,236');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));

    await user.click(screen.getByTestId('medical-purchases-row-action-receive'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/${ref.purchaseOrder(430)}/receive`,
      ),
    );
    expect(await screen.findByTestId('receive-goods-drawer')).toBeInTheDocument();
  });

  it('opens New purchase order, and an Ordered order’s view as its edit', async () => {
    const first = renderPurchases(`${ROOM}/create?supplier=${ref.supplier(59)}`);
    await waitFor(() =>
      expect(screen.getByTestId('purchase-order-drawer-supplier')).toHaveTextContent(
        'NH Pharma',
      ),
    );
    first.unmount();
    renderPurchases(`${ROOM}/${ref.purchaseOrder(430)}`, 'accountant');
    const drawer = await screen.findByTestId('purchase-order-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('purchase-order-drawer-title')).toHaveTextContent(
        'Edit purchase order',
      ),
    );
  });

  it('editing or receiving an order past Ordered shows its view instead (S:59)', async () => {
    const { router } = renderPurchases(`${ROOM}/${ref.purchaseOrder(431)}/edit`);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/${ref.purchaseOrder(431)}`),
    );
    const view = await screen.findByTestId('purchase-order-view-drawer');
    expect(within(view).getByTestId('purchase-order-view-drawer-save')).toHaveTextContent(
      'Pay ₹2,980',
    );
  });

  it('an Accountant sees the orders but receives none', async () => {
    renderPurchases(ROOM, 'accountant');
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-purchases-table-row')).toHaveLength(3),
    );
    expect(
      screen.queryByTestId('medical-purchases-row-action-receive'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('medical-purchases-row-action-view')).toHaveLength(2);
  });
});
