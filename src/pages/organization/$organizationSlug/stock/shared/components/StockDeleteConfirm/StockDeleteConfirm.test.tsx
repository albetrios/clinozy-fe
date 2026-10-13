import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-records-api.ts', () => ({
  deleteStockItem: vi.fn(),
  deleteStockPurchase: vi.fn(),
  deleteStockVendor: vi.fn(),
  restoreStockItem: vi.fn(),
  restoreStockPurchase: vi.fn(),
  restoreStockVendor: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  stockItemRow,
  stockPurchaseRow,
  stockVendorRow,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_PURCHASE_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import {
  deleteStockItem,
  deleteStockPurchase,
  deleteStockVendor,
  restoreStockItem,
  restoreStockPurchase,
  restoreStockVendor,
} from '../../stock-records-api.ts';
import { useStockDeleteBlockText } from './stock-delete-blocks.ts';
import { StockDeleteConfirm, type StockDeleteTarget } from './StockDeleteConfirm.tsx';

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

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string, detail: string) =>
  new HttpError(detail, 409, '/app/stock-items/x', 'DELETE', {
    error: { type: 'request_error', code: 'conflict', reason, detail },
  });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(restoreStockItem).mockResolvedValue(stockItemRow());
  vi.mocked(restoreStockPurchase).mockResolvedValue(stockPurchaseRow());
  vi.mocked(restoreStockVendor).mockResolvedValue(stockVendorRow());
});
afterEach(() => resetStockRoutes());

/** Open the confirm for `target`, pick "Created by mistake" and press Delete. */
async function confirm(target: StockDeleteTarget, title: string) {
  const user = setup();
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  renderStockDrawer(
    <StockDeleteConfirm target={target} onClose={onClose} onDeleted={onDeleted} />,
  );
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(title)).toBeInTheDocument();
  expect(dialog).toHaveTextContent(target.record ?? target.name);
  await user.click(within(dialog).getByRole('radio', { name: 'Created by mistake' }));
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  return { onClose, onDeleted, dialog };
}

/** The Undo the toast offered. */
const undoOf = (call = 0) =>
  (notifyMock.undo.mock.calls[call] as [string, { onUndo: () => void }])[1].onUndo;

describe('StockDeleteConfirm (clinic-stock.md:289–301)', () => {
  it('a row deletes an item with the reason: "… removed" + Undo, which restores it', async () => {
    vi.mocked(deleteStockItem).mockResolvedValue(undefined);
    const { onDeleted } = await confirm(
      { kind: 'item', id: TEST_STOCK_ITEM_ID, name: 'Soframycin 30 gm', from: 'row' },
      'Delete this item?',
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteStockItem).toHaveBeenCalledWith({
      id: TEST_STOCK_ITEM_ID,
      reason: 'mistake',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Soframycin 30 gm removed',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    undoOf()();
    await waitFor(() =>
      expect(restoreStockItem).toHaveBeenCalledWith(
        TEST_STOCK_ITEM_ID,
        expect.any(String),
      ),
    );
  });

  it('the drawer deletes an item: "… deleted"', async () => {
    vi.mocked(deleteStockItem).mockResolvedValue(undefined);
    const { onDeleted } = await confirm(
      { kind: 'item', id: TEST_STOCK_ITEM_ID, name: 'Fucibet', from: 'drawer' },
      'Delete this item?',
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(notifyMock.undo).toHaveBeenCalledWith('Fucibet deleted', expect.anything());
  });

  it('deletes a purchase by its number, its supplier in the pill, and restores it', async () => {
    vi.mocked(deleteStockPurchase).mockResolvedValue(undefined);
    const { onDeleted } = await confirm(
      {
        kind: 'purchase',
        id: TEST_STOCK_PURCHASE_ID,
        name: '#16',
        seq: 16,
        record: 'Ankur Pharma',
      },
      'Delete this purchase?',
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Purchase #16 deleted',
      expect.anything(),
    );
    undoOf()();
    await waitFor(() => expect(restoreStockPurchase).toHaveBeenCalled());
  });

  it('deletes a clinic vendor nothing is owed', async () => {
    vi.mocked(deleteStockVendor).mockResolvedValue(undefined);
    const { onDeleted } = await confirm(
      { kind: 'vendor', id: TEST_STOCK_VENDOR_ID, name: 'Ankur Pharma', from: 'row' },
      'Delete this clinic vendor?',
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    undoOf()();
    await waitFor(() => expect(restoreStockVendor).toHaveBeenCalled());
  });

  it('a refused delete says why, in the member’s words, and closes — no Undo', async () => {
    vi.mocked(deleteStockItem).mockRejectedValue(
      conflict(
        'item_has_stock',
        'This item still has stock — write it off before deleting it',
      ),
    );
    const { onClose, onDeleted } = await confirm(
      { kind: 'item', id: TEST_STOCK_ITEM_ID, name: 'Soframycin 30 gm', from: 'row' },
      'Delete this item?',
    );
    const words = renderHook(() => useStockDeleteBlockText()).result.current;
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(words('item_has_stock')),
    );
    expect(onClose).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('any other failure keeps the confirm open with the API’s words', async () => {
    vi.mocked(deleteStockVendor).mockRejectedValue(
      new HttpError('Server error', 500, '/app/stock-vendors/x', 'DELETE', {
        error: { detail: 'Something went wrong' },
      }),
    );
    const { onClose, dialog } = await confirm(
      { kind: 'vendor', id: TEST_STOCK_VENDOR_ID, name: 'Ankur Pharma', from: 'row' },
      'Delete this clinic vendor?',
    );
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Something went wrong'),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it('stays closed without a target', () => {
    renderStockDrawer(<StockDeleteConfirm target={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
