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

  it('fills the items from the quick line — "azel 20 +2 @180" — the Low stock chips and Browse', async () => {
    const user = setup();
    renderMedicalDrawer(<PurchaseOrderDrawer mode="create" open onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('Akshar Medicines'),
    );
    const drawer = screen.getByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    const line = await within(drawer).findByTestId(`${D}-quick-line-input`);
    expect(line).toHaveAttribute(
      'placeholder',
      'Type medicine, qty, free, rate · e.g. azel 20 +2 @180',
    );
    // The low medicines the order lacks (H:5389): "Arganlif Hair Serum 50 ml · 2 left".
    const chips = () => within(drawer).getByTestId(`${D}-quick-line-frequent`);
    expect(chips()).toHaveTextContent('Low stock');
    expect(within(chips()).getAllByRole('button')).toHaveLength(3);

    // Twenty and two free at ₹180 — the shorthand's pills while it is typed.
    await user.type(line, 'azel 20 +2 @180');
    expect(within(drawer).getByText('+2 free')).toBeVisible();
    expect(within(drawer).getByText('@ ₹180')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId(`${D}-summary`)).toHaveTextContent('₹3,600');
    expect(within(drawer).getAllByTestId(`${D}-lines-free`)[0]).toHaveValue('2');

    // A chip orders the medicine up to its fill-up level at its best rate: 10 − 2 at ₹677.
    await user.click(
      within(chips()).getByRole('button', { name: /Arganlif Hair Serum 50 ml · 2 left/ }),
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-summary`)).toHaveTextContent('₹9,016'),
    );
    expect(within(chips()).getAllByRole('button')).toHaveLength(2);

    // Browse: All · Low stock · From Akshar Medicines · Other medicines; a tap adds one.
    await user.click(within(drawer).getByTestId(`${D}-quick-line-browse`));
    const panel = await screen.findByTestId(`${D}-quick-line-browse-panel`);
    expect(
      within(panel)
        .getAllByRole('button', { pressed: false })
        .concat(within(panel).getAllByRole('button', { pressed: true }))
        .map((button) => button.textContent),
    ).toEqual(
      expect.arrayContaining(['Low stock', 'From Akshar Medicines', 'Other medicines']),
    );
    await user.click(within(panel).getByTestId(`${D}-quick-line-browse-group-low`));
    const tiles = within(panel).getAllByTestId(`${D}-quick-line-browse-tile`);
    expect(tiles).toHaveLength(3);
    expect(tiles.filter((tile) => tile.hasAttribute('data-added'))).toHaveLength(1);
    expect(panel).toHaveTextContent('2 added');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    // "New medicine name": a quick medicine on the supplier, at MRP ₹0.
    await user.type(
      within(panel).getByTestId(`${D}-quick-line-browse-new`),
      'Azel cream{Enter}',
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Azel cream added · set MRP later in Stock',
      ),
    );
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(3),
    );
    const [quick] = clinicFixtures.medicines.snapshot(
      (medicine) => medicine.name === 'Azel cream',
    );
    expect(quick).toMatchObject({ isQuick: true, mrp: 0 });
    expect(quick?.supplierRates.map((rate) => rate.supplierId)).toEqual([
      ref.supplier(52),
    ]);
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
