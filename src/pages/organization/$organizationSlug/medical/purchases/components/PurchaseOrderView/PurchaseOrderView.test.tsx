import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

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

const { notifyMock, printMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  printMock: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

const D = 'purchase-order-view-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of [...Object.values(notifyMock), printMock]) fn.mockReset();
  resetClinicFixtures();
});
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
      `${fsi('Shree Ramdev Medical Agency')} · received, stock added · items locked`,
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
    const onPay = vi.fn();
    const view = renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} onPay={onPay} />,
    );
    let drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent(`${fsi('Akshar Medicines')} · paid, locked`);
    // ₹1,200 paid of ₹1,296 — still Paid, nothing owed (H:5421).
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Paid ₹1,200 of ₹1,296',
    );
    // Its primary is Print (Q-M7), never Pay.
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Print');
    expect(onPay).not.toHaveBeenCalled();
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

  it('prints a paid order’s A4 purchase order (Q-M7); a failed read is told', async () => {
    const user = setup();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(428));
    const view = renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    view.unmount();

    // The sheet it prints: the order, its supplier, the clinic's footer.
    const [[sheet]] = printMock.mock.calls as [[ReactElement]];
    render(sheet);
    expect(screen.getByTestId('purchase-order-print')).toHaveTextContent('PO #428');
    expect(screen.getByTestId('purchase-order-print')).toHaveTextContent(
      'Akshar Medicines',
    );
    expect(screen.getByTestId('print-footer')).toHaveTextContent('Purchase order from');

    // An order the server no longer has: the read's failure is a toast.
    renderMedicalDrawer(
      <PurchaseOrderView
        open
        order={{ ...order, id: '00000000-0000-4000-8000-000000000000' }}
        onClose={vi.fn()}
      />,
    );
    await user.click(within(await screen.findByTestId(D)).getByTestId(`${D}-save`));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(printMock).toHaveBeenCalledTimes(1);
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
