import { screen, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchPurchaseOrder } from '../../../shared/medical-api.ts';
import { PurchaseOrderView } from './PurchaseOrderView.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const D = 'purchase-order-view-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('PurchaseOrderView (medical.md:333–334)', () => {
  it('a received order: locked lines, "Payable ₹2,980" and "Pay ₹2,980" (Q-M1)', async () => {
    const user = setup();
    const onPay = vi.fn();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(431));
    renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} onPay={onPay} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Purchase order');
    expect(drawer).toHaveTextContent(
      'Shree Ramdev Medical Agency · received, stock added · items locked',
    );
    expect(within(drawer).getByTestId(`${D}-bill-no`)).toHaveTextContent('1631');
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Payable ₹2,980',
    );
    expect(within(drawer).getByTestId(`${D}-dismiss`)).toHaveTextContent('Close');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ id: order.id }));
  });

  it('a paid order is locked with what was paid, and offers no payment', async () => {
    const order = await fetchPurchaseOrder(ref.purchaseOrder(428));
    const view = renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} onPay={vi.fn()} />,
    );
    let drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent('Akshar Medicines · paid, locked');
    // ₹1,200 paid of ₹1,296 — still Paid, nothing owed (H:5421).
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Paid ₹1,200 of ₹1,296',
    );
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    view.unmount();

    renderMedicalDrawer(
      <PurchaseOrderView
        open
        order={{ ...order, paid: order.total }}
        onClose={vi.fn()}
      />,
    );
    drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('Paid ₹1,296');
  });

  it('offers no payment to a member who cannot pay, and shimmers until read', async () => {
    const order = await fetchPurchaseOrder(ref.purchaseOrder(431));
    const view = renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    view.unmount();
    renderMedicalDrawer(<PurchaseOrderView open order={undefined} onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
