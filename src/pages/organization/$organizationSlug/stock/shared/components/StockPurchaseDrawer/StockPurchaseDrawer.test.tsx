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
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchStockPurchase } from '../../stock-api.ts';
import { StockPurchaseDrawer } from './StockPurchaseDrawer.tsx';

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

const D = 'stock-purchase-drawer';
const ANKUR = ref.stockVendor(1);
/** Retises Nano Peel (1 bottle, minimum 1) and D-Tan Mask (out) are at or below their minimum. */
const RETISES = ref.stockItem(164);
const D_TAN = ref.stockItem(161);
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const qtyOf = (id: string) =>
  clinicFixtures.stockItems.snapshot((item) => item.id === id)[0]?.qtyMilli;
const badges = (drawer: HTMLElement) => within(drawer).getByTestId(`${D}-badges`);
const rates = (drawer: HTMLElement) => within(drawer).getAllByTestId(`${D}-lines-rate`);

/** Pick Ankur Pharma as the supplier. */
async function pickAnkur(user: ReturnType<typeof setup>, drawer: HTMLElement) {
  await user.click(within(drawer).getByTestId(`${D}-vendor`));
  await user.click(await screen.findByTestId(`${D}-vendor-option-${ANKUR}`));
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockPurchaseDrawer (clinic-stock.md:142–157, 247–259)', () => {
  it('asks for the supplier first; reorders the low items; checks each rate; receives the lines', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('New purchase');
    expect(drawer).toHaveTextContent('Items received are added to stock');
    expect(badges(drawer)).toHaveTextContent('No supplierBill ₹0Paid');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick a supplier');

    await pickAnkur(user, drawer);
    expect(badges(drawer)).toHaveTextContent('Ankur Pharma');
    await user.click(within(drawer).getByTestId(`${D}-quick-fill-reorder`));
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2),
    );
    // Ordered up to each maximum: Retises 4 − 1, D-Tan 6 − 0.
    expect(
      within(drawer)
        .getAllByTestId(`${D}-lines-qty`)
        .map((qty) => (qty as HTMLInputElement).value),
    ).toEqual(['3', '6']);

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter the rate');
    for (const rate of rates(drawer))
      expect(rate).toHaveAttribute('aria-invalid', 'true');

    // A typed rate takes its cell's red edge away; the other keeps it.
    await user.type(rates(drawer)[0] as HTMLElement, '250');
    expect(rates(drawer)[0]).not.toHaveAttribute('aria-invalid');
    expect(rates(drawer)[1]).toHaveAttribute('aria-invalid', 'true');
    await user.type(rates(drawer)[1] as HTMLElement, '80');
    expect(badges(drawer)).toHaveTextContent('Bill ₹1,230₹1,230 due');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase saved · stock updated');
    expect(qtyOf(RETISES)).toBe(4000);
    expect(qtyOf(D_TAN)).toBe(6000);
  });

  it('`?reorder=low` waits for the items, then opens on the reordered lines', async () => {
    renderStockDrawer(
      <StockPurchaseDrawer
        mode="create"
        prefill={{ reorder: 'low' }}
        open
        onClose={vi.fn()}
      />,
    );
    // The pending drawer gives way to the form once the catalogue is in.
    await waitFor(() => expect(screen.getAllByTestId(`${D}-lines-row`)).toHaveLength(2));
    expect(screen.getByTestId(`${D}-step-items`)).toHaveAttribute('data-state', 'open');
  });

  it('a purchase without lines says "Purchase saved"; the bill follows what is typed', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await pickAnkur(user, drawer);
    await user.type(within(drawer).getByTestId(`${D}-bill-no`), 'AP-3001');
    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-bill`), '500');
    await user.click(within(drawer).getByTestId(`${D}-paid-quick-full`));
    expect(badges(drawer)).toHaveTextContent('Bill ₹500Paid');
    await user.click(within(drawer).getByTestId(`${D}-paid-quick-nothing`));
    expect(badges(drawer)).toHaveTextContent('₹500 due');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase saved');
    expect(
      clinicFixtures.stockPurchases.snapshot((row) => row.billNo === 'AP-3001')[0],
    ).toMatchObject({ vendorId: ANKUR, bill: 50_000, paid: 0, lines: [] });
  });

  it('edits a purchase: "#16", what is due, no Reorder; Delete with a reason and Undo', async () => {
    const user = setup();
    const onClose = vi.fn();
    const purchase = await fetchStockPurchase(ref.stockPurchase(16));
    renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={purchase} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit purchase');
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#16');
    await waitFor(() =>
      expect(badges(drawer)).toHaveTextContent('Shivam WaterBill ₹1,200₹600 due'),
    );
    expect(
      within(drawer).queryByTestId(`${D}-quick-fill-reorder`),
    ).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this purchase?');
    expect(confirm).toHaveTextContent('Shivam Water');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Purchase #16 deleted',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('saves an edit without moving stock again', async () => {
    const user = setup();
    const onClose = vi.fn();
    const purchase = await fetchStockPurchase(ref.stockPurchase(16));
    const before = qtyOf(ref.stockItem(160));
    renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={purchase} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-paid-quick-full`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase saved');
    expect(qtyOf(ref.stockItem(160))).toBe(before);
    expect(
      clinicFixtures.stockPurchases.snapshot((row) => row.id === purchase.id)[0]?.paid,
    ).toBe(120_000);
  });

  it('is view only without Edit, and waits for a purchase still loading', async () => {
    const purchase = await fetchStockPurchase(ref.stockPurchase(16));
    const view = renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={purchase} open onClose={vi.fn()} />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument(),
    );
    view.unmount();
    renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(D)).toHaveTextContent('Edit purchase');
  });
});
