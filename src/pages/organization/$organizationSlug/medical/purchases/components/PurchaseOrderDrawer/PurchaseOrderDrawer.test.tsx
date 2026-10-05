import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchPurchaseOrder } from '../../../shared/medical-api.ts';
import { PurchaseOrderDrawer } from './PurchaseOrderDrawer.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const D = 'purchase-order-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('PurchaseOrderDrawer (medical.md:254–267)', () => {
  it('opens on the first supplier; "Reorder low stock" fills the lines; a missing rate names its medicine', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<PurchaseOrderDrawer mode="create" open onClose={onClose} />);
    // Prefilled with the first supplier (`medical.md:258`) once the list is read.
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('Akshar Medicines'),
    );
    const drawer = screen.getByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'New purchase order',
    );
    expect(drawer).toHaveTextContent('Order → receive → pay');

    await user.click(within(drawer).getByTestId(`${D}-quick-fill-reorder`));
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(3),
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    const [firstRate] = within(drawer).getAllByTestId(`${D}-lines-rate`);
    if (!firstRate) throw new Error('expected a rate cell');
    await user.clear(firstRate);
    await user.tab();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.warning).toHaveBeenCalledWith(
        expect.stringMatching(/^Enter the rate for /),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();

    await user.type(firstRate, '700');
    await user.tab();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase order saved');
    expect(
      clinicFixtures.purchaseOrders.snapshot(
        (order) => order.stage === 'ordered' && order.supplierId === ref.supplier(52),
      ),
    ).toHaveLength(1);
  });

  it('`?supplier=` names the supplier; `?reorder=low` opens on Items at the supplier most of them use', async () => {
    const first = renderMedicalDrawer(
      <PurchaseOrderDrawer
        mode="create"
        open
        prefill={{ supplierId: ref.supplier(59) }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('NH Pharma'),
    );
    first.unmount();

    renderMedicalDrawer(
      <PurchaseOrderDrawer
        mode="create"
        open
        prefill={{ reorder: 'low' }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId(`${D}-lines-row`)).toHaveLength(3));
    expect(screen.getByTestId(`${D}-summary`)).toHaveTextContent(/₹/);
  });

  it('edits an Ordered order, with the red "Cancel order" for an Admin', async () => {
    const user = setup();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    renderMedicalDrawer(
      <PurchaseOrderDrawer mode="edit" order={order} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Edit purchase order',
    );
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#430');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,236');
    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Cancel this purchase order?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('₹4,236');
  });

  it('a Pharmacist edits but cannot cancel; the drawer shimmers until the order is read', async () => {
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    const view = renderMedicalDrawer(
      <PurchaseOrderDrawer mode="edit" order={order} open onClose={vi.fn()} />,
      { role: 'pharmacist' },
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    view.unmount();
    renderMedicalDrawer(
      <PurchaseOrderDrawer mode="edit" order={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
