import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPurchaseOrderSheet: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { purchaseOrderRow } from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchPurchaseOrderSheet } from '../../../shared/medical-api.ts';
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

/** PO #431, received: ₹4,236 from Ankur Pharma, ₹827 still due. */
const RECEIVED = purchaseOrderRow();

/** PO #428, paid: ₹1,200 paid of ₹1,296, the rest set off by a supplier credit. */
const PAID = purchaseOrderRow({
  id: 'mpo_order4280000000000000',
  seq: 428,
  stage: 'paid',
  supplier: {
    id: 'sup_akshar000000000000000',
    name: 'Akshar Medicines',
    phone: '+919876500033',
    gstNumber: null,
  },
  total: 1296,
  paid: 1200,
  credited: 96,
  due: 0,
  paymentStatus: 'paid',
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of [...Object.values(notifyMock), printMock]) fn.mockReset();
  signInTestMember();
  vi.mocked(fetchPurchaseOrderSheet).mockResolvedValue({
    order: PAID,
    organization: {
      name: 'Cresence Skin Clinic',
      specialties: ['skin'],
      currency: 'INR',
    },
    branch: { phone: '+919812300044', gstNumber: '24AAACC1234F1Z5' },
  });
});
afterEach(() => resetMedicalRoutes());

describe('PurchaseOrderView (medical.md:333–334)', () => {
  it('a received order: locked lines, "Payable ₹827" and "Pay ₹827" (Q-M1) — the server’s due', async () => {
    const user = setup();
    const onPay = vi.fn();
    const order = RECEIVED;
    renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} onPay={onPay} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Purchase order');
    expect(drawer).toHaveTextContent(
      `${fsi('Ankur Pharma')} · received, stock added · items locked`,
    );
    expect(within(drawer).getByTestId(`${D}-bill-no`)).toHaveTextContent('T-82370');
    const [line] = within(drawer).getAllByTestId(`${D}-lines-row`);
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(1);
    // The line's rate and amount as the API reads them, rupees.
    expect(line).toHaveTextContent('Azelaic gel 15g');
    expect(line).toHaveTextContent('₹423.60');
    expect(line).toHaveTextContent('₹4,236');
    // Its GST rate, and the order's taxable and GST totals (feat-purchase-line-gst A-4).
    expect(line).toHaveTextContent('12%');
    expect(within(drawer).getByTestId(`${D}-gst-totals`)).toHaveTextContent(
      'Taxable ₹3,782.14 · GST ₹453.86',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('Payable ₹827');
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Pay ₹827');
    expect(within(drawer).getByTestId(`${D}-dismiss`)).toHaveTextContent('Close');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ id: order.id }));
  });

  it('a paid order is locked with what was paid, and offers no payment', async () => {
    const order = PAID;
    const onPay = vi.fn();
    const view = renderMedicalDrawer(
      <PurchaseOrderView open order={order} onClose={vi.fn()} onPay={onPay} />,
    );
    let drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent(`${fsi('Akshar Medicines')} · paid, locked`);
    // ₹1,200 paid and ₹96 set off by the supplier's credits — Paid, nothing owed (H:5421, MD11).
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Paid ₹1,200 + ₹96 in supplier credits',
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

  it('a paid order short of its total, with no credits, says what was paid of what', async () => {
    renderMedicalDrawer(
      <PurchaseOrderView open order={{ ...PAID, credited: 0 }} onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Paid ₹1,200 of ₹1,296',
    );
  });

  it('prints a paid order’s A4 purchase order (Q-M7); a failed read is told', async () => {
    const user = setup();
    const order = PAID;
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
    expect(fetchPurchaseOrderSheet).toHaveBeenCalledWith(order.id);

    // An order the server no longer has: the read's failure is a toast.
    vi.mocked(fetchPurchaseOrderSheet).mockRejectedValueOnce(new Error('not found'));
    renderMedicalDrawer(
      <PurchaseOrderView
        open
        order={{ ...order, id: 'mpo_gone00000000000000000' }}
        onClose={vi.fn()}
      />,
    );
    await user.click(within(await screen.findByTestId(D)).getByTestId(`${D}-save`));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('offers no payment to a member who cannot pay, and shimmers until read', async () => {
    const order = RECEIVED;
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
