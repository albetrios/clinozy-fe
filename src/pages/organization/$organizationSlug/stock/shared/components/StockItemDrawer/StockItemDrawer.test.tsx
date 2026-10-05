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
import { fetchStockItem } from '../../stock-api.ts';
import { StockItemDrawer } from './StockItemDrawer.tsx';
import { StockNewItemDrawer } from './StockNewItemDrawer.tsx';

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

const D = 'stock-item-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const itemNamed = (name: string) =>
  clinicFixtures.stockItems.snapshot((row) => row.name === name)[0];

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockItemDrawer (clinic-stock.md:105–124, 219–231)', () => {
  it('opens New item on Consumables · pack and refuses no name', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockItemDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('New item');
    expect(drawer).toHaveTextContent('Clinic consumable or equipment');
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent('Consumables');
    expect(within(drawer).getByTestId(`${D}-category-consumables`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId(`${D}-unit-pack`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');
    expect(onClose).not.toHaveBeenCalled();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('adds an item with its contents, its opening stock and its levels', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(
      <StockItemDrawer
        mode="create"
        prefill={{ name: ' Lidocaine gel ' }}
        open
        onClose={onClose}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue('Lidocaine gel');
    await user.click(within(drawer).getByTestId(`${D}-category-creams_serums`));
    await user.click(within(drawer).getByTestId(`${D}-unit-tube`));
    await user.type(within(drawer).getByTestId(`${D}-contents`), '30');
    await user.click(within(drawer).getByTestId(`${D}-measure-g`));
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'Creams & Serums',
    );

    await user.click(within(drawer).getByTestId(`${D}-step-levels-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-in-stock`), '2.5');
    await user.type(within(drawer).getByTestId(`${D}-usage`), '0.5');
    await user.click(within(drawer).getByTestId(`${D}-max-decrease`));

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Item saved');
    expect(itemNamed('Lidocaine gel')).toMatchObject({
      category: 'creams_serums',
      unit: 'tube',
      sizePerUnit: 30_000,
      measureUnit: 'g',
      qtyMilli: 2500,
      usagePerWeekMilli: 500,
      minQty: 1,
      maxQty: 9,
    });
  });

  it('lays its fields on the grid as the design (H:5270–5272)', async () => {
    const user = setup();
    renderStockDrawer(<StockItemDrawer mode="create" open onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    const columns = (testId: string) =>
      within(drawer)
        .getByTestId(`${D}-${testId}`)
        .closest('[class*="col-span-"]')
        ?.className.match(/col-span-(\d)/)?.[1];
    // Name a half that stays a half; "Contents per" a third, "Measured in" the rest.
    expect(columns('name')).toBe('3');
    expect(columns('unit-pack')).toBe('6');
    expect(columns('contents')).toBe('2');
    expect(columns('measure-ml')).toBe('4');

    await user.click(within(drawer).getByTestId(`${D}-step-levels-trigger`));
    expect(columns('in-stock')).toBe('2');
    expect(columns('usage')).toBe('2');
    expect(columns('min-decrease')).toBe('2');
    // The third left alone in its row widens to half.
    expect(columns('max-decrease')).toBe('3');

    await user.click(within(drawer).getByTestId(`${D}-step-vendor-trigger`));
    expect(columns('vendor')).toBe('3');
  });

  it('edits an item: "#167" and its pill, a changed count saved as an Adjust', async () => {
    const user = setup();
    const onClose = vi.fn();
    const item = await fetchStockItem(ref.stockItem(167));
    renderStockDrawer(<StockItemDrawer mode="edit" item={item} open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit item');
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#167');
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'Creams & Serums',
    );
    // The supplier peeks while its step is closed.
    expect(within(drawer).getByTestId(`${D}-step-vendor`)).toHaveTextContent(
      'Ankur Pharma',
    );

    await user.click(within(drawer).getByTestId(`${D}-step-levels-trigger`));
    await user.clear(within(drawer).getByTestId(`${D}-in-stock`));
    await user.type(within(drawer).getByTestId(`${D}-in-stock`), '2');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(itemNamed('Soframycin 30 gm')?.qtyMilli).toBe(2000);
    expect(
      clinicFixtures.stockMovements.snapshot((row) => row.itemId === item.id).at(-1),
    ).toMatchObject({ type: 'adjust', deltaMilli: -1000 });
  });

  it('deletes from the drawer with a reason: "… deleted" + Undo', async () => {
    const user = setup();
    const onClose = vi.fn();
    const item = await fetchStockItem(ref.stockItem(167));
    renderStockDrawer(<StockItemDrawer mode="edit" item={item} open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this item?');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Soframycin 30 gm deleted',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    expect(itemNamed('Soframycin 30 gm')).toBeUndefined();
  });

  it('is view only without Edit, and waits for a record still loading', async () => {
    const item = await fetchStockItem(ref.stockItem(167));
    const view = renderStockDrawer(
      <StockItemDrawer mode="edit" item={item} open onClose={vi.fn()} />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument(),
    );
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    view.unmount();

    renderStockDrawer(
      <StockItemDrawer mode="edit" item={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(D)).toHaveTextContent('Edit item');
  });
});

describe('StockNewItemDrawer (clinic-stock.md:187–201)', () => {
  it('adds a piece of Creams & Serums named from the picker, 1 to 5, from the vendor', async () => {
    const user = setup();
    const onSaved = vi.fn();
    const N = 'stock-new-item-drawer-stacked';
    renderStockDrawer(
      <StockNewItemDrawer
        open
        onClose={vi.fn()}
        name=" Cotton "
        vendorId={ref.stockVendor(1)}
        onSaved={onSaved}
      />,
    );
    const drawer = await screen.findByTestId(N);
    expect(within(drawer).getByTestId(`${N}-title`)).toHaveTextContent('New clinic item');
    expect(drawer).toHaveTextContent('Used in procedures · not for sale');
    expect(within(drawer).getByTestId(`${N}-name`)).toHaveValue('Cotton');
    expect(within(drawer).getByTestId(`${N}-unit-piece`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Six units only.
    expect(within(drawer).queryByTestId(`${N}-unit-litre`)).not.toBeInTheDocument();
    expect(within(drawer).getByTestId(`${N}-dismiss`)).toHaveTextContent('Back');
    expect(within(drawer).getByTestId(`${N}-step-details-peek`)).toHaveTextContent(
      /Minimum\s*1\s*Maximum\s*5/,
    );
    const columns = (testId: string) =>
      within(drawer)
        .getByTestId(`${N}-${testId}`)
        .closest('[class*="col-span-"]')
        ?.className.match(/col-span-(\d)/)?.[1];
    expect(columns('name')).toBe('3');
    await user.click(within(drawer).getByTestId(`${N}-step-details-trigger`));
    // Minimum and Maximum share their row as halves (H:4069).
    expect(columns('min-decrease')).toBe('3');
    expect(columns('max-decrease')).toBe('3');

    await user.click(within(drawer).getByTestId(`${N}-save`));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ name: 'Cotton' });
    expect(notifyMock.success).toHaveBeenCalledWith('Cotton added to clinic items');
    expect(itemNamed('Cotton')).toMatchObject({
      category: 'creams_serums',
      unit: 'piece',
      minQty: 1,
      maxQty: 5,
      vendorId: ref.stockVendor(1),
    });
  });

  it('asks for a name before it adds anything', async () => {
    const user = setup();
    const onSaved = vi.fn();
    const N = 'stock-new-item-drawer-stacked';
    renderStockDrawer(
      <StockNewItemDrawer open onClose={vi.fn()} name="" onSaved={onSaved} />,
    );
    const drawer = await screen.findByTestId(N);
    await user.click(within(drawer).getByTestId(`${N}-step-details-trigger`));
    await user.click(within(drawer).getByTestId(`${N}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
