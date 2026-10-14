import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchStockItem: vi.fn(),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
}));
vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createStockItem: vi.fn(),
  updateStockItem: vi.fn(),
  quickCreateStockItem: vi.fn(),
  deleteStockItem: vi.fn(),
  restoreStockItem: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  stockItemRow,
  stockVendorRow,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import {
  fetchAllStockItems,
  fetchAllStockVendors,
  fetchStockItem,
} from '../../stock-api.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import {
  createStockItem,
  deleteStockItem,
  quickCreateStockItem,
  updateStockItem,
} from '../../stock-records-api.ts';
import { useStockDeleteBlockText } from '../StockDeleteConfirm/index.ts';
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

/** A refusal or a field error as clinozy-be answers it. */
const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError('refused', status, '/app/stock-items', 'POST', { error });

/** The room's words for a key, as the drawer says them. */
const wordsOf = (key: string) =>
  renderHook(() => useTranslation(STOCK_DRAWERS_NS)).result.current.t(key);

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchAllStockVendors).mockResolvedValue([stockVendorRow()]);
  vi.mocked(fetchAllStockItems).mockResolvedValue([stockItemRow()]);
});
afterEach(() => resetStockRoutes());

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
    expect(createStockItem).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('adds an item with its contents, its opening stock and its levels', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(createStockItem).mockResolvedValue(stockItemRow({ name: 'Lidocaine gel' }));
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
    // In stock is the opening quantity (`opening_quantity`).
    expect(createStockItem).toHaveBeenCalledWith({
      input: {
        name: 'Lidocaine gel',
        category: 'creams_serums',
        unit: 'tube',
        sizePerUnit: 30_000,
        measureUnit: 'g',
        minQty: 1,
        maxQty: 9,
        usagePerWeekMilli: 500,
        vendorId: null,
        qtyMilli: 2500,
      },
      idempotencyKey: expect.any(String),
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

  it('edits an item: "#167" and its pill; the save hands the read and the fields over', async () => {
    const user = setup();
    const onClose = vi.fn();
    const item = stockItemRow();
    vi.mocked(updateStockItem).mockResolvedValue(stockItemRow({ qtyMilli: 2000 }));
    renderStockDrawer(<StockItemDrawer mode="edit" item={item} open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit item');
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#167');
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'Creams & Serums',
    );
    // The supplier peeks while its step is closed.
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-step-vendor`)).toHaveTextContent(
        'Ankur Pharma',
      ),
    );

    await user.click(within(drawer).getByTestId(`${D}-step-levels-trigger`));
    await user.clear(within(drawer).getByTestId(`${D}-in-stock`));
    await user.type(within(drawer).getByTestId(`${D}-in-stock`), '2');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The item's changed fields (with its `updated_at`), then In stock as an Adjust.
    expect(updateStockItem).toHaveBeenCalledWith({
      record: item,
      input: expect.objectContaining({ name: 'Soframycin 30 gm', qtyMilli: 2000 }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Item saved');
  });

  it('puts the API’s field errors on their fields and opens their step', async () => {
    const user = setup();
    vi.mocked(updateStockItem).mockRejectedValue(
      refusal(400, {
        type: 'validation_error',
        errors: [
          { field: 'body.max_quantity', message: 'Maximum can’t be under the minimum' },
        ],
      }),
    );
    renderStockDrawer(
      <StockItemDrawer mode="edit" item={stockItemRow()} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-step-levels-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-max-decrease`));
    await user.click(within(drawer).getByTestId(`${D}-step-item-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Maximum can’t be under the minimum'),
    );
    expect(within(drawer).getByTestId(`${D}-step-levels`)).toHaveTextContent(
      'Maximum can’t be under the minimum',
    );
  });

  it('a name another item has goes on Name in the room’s words (`409 record_already_exists`)', async () => {
    const user = setup();
    vi.mocked(createStockItem).mockRejectedValue(
      refusal(409, {
        type: 'request_error',
        code: 'conflict',
        reason: 'record_already_exists',
        detail: 'Already exists',
      }),
    );
    renderStockDrawer(
      <StockItemDrawer
        mode="create"
        prefill={{ name: 'Gauze' }}
        open
        onClose={vi.fn()}
      />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-save`));
    const taken = wordsOf(STOCK_DRAWER_KEYS.item.nameTaken);
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith(taken));
    expect(within(drawer).getByTestId(`${D}-name`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('a save over someone else’s (`409 record_changed`) offers Reload, which reads the item again', async () => {
    const user = setup();
    vi.mocked(updateStockItem).mockRejectedValue(
      refusal(409, {
        type: 'request_error',
        code: 'conflict',
        reason: 'record_changed',
        detail: 'Someone changed this item since you opened it',
      }),
    );
    vi.mocked(fetchStockItem).mockResolvedValue(
      stockItemRow({ name: 'Soframycin 30 gm tube', updatedAt: '2026-10-10T06:00:00Z' }),
    );
    renderStockDrawer(
      <StockItemDrawer mode="edit" item={stockItemRow()} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-category-masks`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    const [message, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    expect(message).toBe(
      'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
    );
    options.action.onClick();
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue(
        'Soframycin 30 gm tube',
      ),
    );
    expect(fetchStockItem).toHaveBeenCalledWith(TEST_STOCK_ITEM_ID);
  });

  it('Delete goes at zero with a reason: "… deleted" + Undo', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(deleteStockItem).mockResolvedValue(undefined);
    const empty = stockItemRow({ qtyMilli: 0, level: 'out' });
    renderStockDrawer(
      <StockItemDrawer mode="edit" item={empty} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this item?');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteStockItem).toHaveBeenCalledWith({
      id: TEST_STOCK_ITEM_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Soframycin 30 gm deleted',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('Delete on an item with stock says to adjust it to 0 first, and asks nothing', async () => {
    const user = setup();
    renderStockDrawer(
      <StockItemDrawer mode="edit" item={stockItemRow()} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const blockText = renderHook(() => useStockDeleteBlockText()).result.current;
    expect(notifyMock.info).toHaveBeenCalledWith(blockText('item_has_stock'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteStockItem).not.toHaveBeenCalled();
  });

  it('is view only without Edit, and waits for a record still loading', async () => {
    const view = renderStockDrawer(
      <StockItemDrawer mode="edit" item={stockItemRow()} open onClose={vi.fn()} />,
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
  const N = 'stock-new-item-drawer-stacked';

  it('adds a piece of Creams & Serums named from the picker, 1 to 5, from the vendor', async () => {
    const user = setup();
    const onSaved = vi.fn();
    const cotton = stockItemRow({ name: 'Cotton', unit: 'piece', qtyMilli: 0 });
    vi.mocked(quickCreateStockItem).mockResolvedValue(cotton);
    renderStockDrawer(
      <StockNewItemDrawer
        open
        onClose={vi.fn()}
        name=" Cotton "
        vendorId={TEST_STOCK_VENDOR_ID}
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
    // The collapsed step reads its values back; each field's name is read out with it.
    expect(within(drawer).getByTestId(`${N}-step-details-peek`)).toHaveTextContent(
      /Minimum:\s*1\s*Maximum:\s*5/,
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
    expect(onSaved.mock.calls[0]?.[0]).toBe(cotton);
    expect(notifyMock.success).toHaveBeenCalledWith('Cotton added to clinic items');
    expect(quickCreateStockItem).toHaveBeenCalledWith({
      input: {
        name: 'Cotton',
        category: 'creams_serums',
        unit: 'piece',
        minQty: 1,
        maxQty: 5,
        vendorId: TEST_STOCK_VENDOR_ID,
      },
      idempotencyKey: expect.any(String),
    });
  });

  it('asks for a name before it adds anything', async () => {
    const user = setup();
    const onSaved = vi.fn();
    renderStockDrawer(
      <StockNewItemDrawer open onClose={vi.fn()} name="" onSaved={onSaved} />,
    );
    const drawer = await screen.findByTestId(N);
    await user.click(within(drawer).getByTestId(`${N}-step-details-trigger`));
    await user.click(within(drawer).getByTestId(`${N}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');
    expect(onSaved).not.toHaveBeenCalled();
    expect(quickCreateStockItem).not.toHaveBeenCalled();
  });

  it('a name another item has goes on Name', async () => {
    const user = setup();
    vi.mocked(quickCreateStockItem).mockRejectedValue(
      refusal(409, {
        type: 'request_error',
        code: 'conflict',
        reason: 'record_already_exists',
        detail: 'Already exists',
      }),
    );
    renderStockDrawer(
      <StockNewItemDrawer open onClose={vi.fn()} name="Gauze" onSaved={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(N);
    await user.click(within(drawer).getByTestId(`${N}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        wordsOf(STOCK_DRAWER_KEYS.item.nameTaken),
      ),
    );
    expect(within(drawer).getByTestId(`${N}-name`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
