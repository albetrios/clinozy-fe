import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logStockMovement: vi.fn(),
  revertStockMovement: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { stockItemRow, TEST_STOCK_ITEM_ID } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import type { StockItemRow, StockMovementRecord } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { logStockMovement, revertStockMovement } from '../../stock-records-api.ts';
import { StockUsePopover } from './StockUsePopover.tsx';

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

const P = 'stock-use-popover';
const MOVEMENT_ID = 'smov_used0000000000000000';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A saved use as the API answers it: what it took and what it left (×1000). */
const usedMovement = (deltaMilli: number, afterMilli: number): StockMovementRecord => ({
  id: MOVEMENT_ID,
  itemId: TEST_STOCK_ITEM_ID,
  kind: 'used',
  deltaMilli,
  afterMilli,
  usedFor: null,
  note: null,
  patientTreatmentId: null,
  purchaseId: null,
  stockCountId: null,
  revertsId: null,
  revertedById: null,
  revertReason: null,
  authorId: null,
  createdAt: '2026-10-10T05:35:00.000Z',
});

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('refused', 409, '/app/stock-items/x/movements', 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'refused' },
  });

/** The room's words for a key, as the popover says them. */
const wordsOf = (key: string) =>
  renderHook(() => useTranslation(STOCK_DRAWERS_NS)).result.current.t(key);

/** The rows' Use buttons the popovers anchored to, removed after each test. */
const anchors: HTMLButtonElement[] = [];

/** The row's Use button the popover anchors to. */
function anchorButton() {
  const button = document.createElement('button');
  button.textContent = 'Use';
  document.body.append(button);
  anchors.push(button);
  return button;
}

/** Open the popover for `item` (Soframycin, 3 tubes of 30 g, by default). */
async function openFor(item: StockItemRow = stockItemRow()) {
  const onClose = vi.fn();
  const onMoreDetails = vi.fn();
  renderStockDrawer(
    <StockUsePopover
      item={item}
      anchor={anchorButton()}
      onClose={onClose}
      onMoreDetails={onMoreDetails}
    />,
  );
  return { popover: await screen.findByTestId(P), onClose, onMoreDetails, item };
}

/** The Undo the toast offered. */
const undoOf = () =>
  (notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }])[1].onUndo;

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => {
  resetStockRoutes();
  for (const anchor of anchors.splice(0)) anchor.remove();
});

describe('StockUsePopover (clinic-stock.md:89–103, 205–217)', () => {
  it('opens on one unit, focused, and uses it — "… left" the server’s — with Undo, a revert', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(usedMovement(-1000, 2000));
    vi.mocked(revertStockMovement).mockResolvedValue(usedMovement(1000, 3000));
    const { popover, onClose } = await openFor();
    expect(popover).toHaveAccessibleName('Use Soframycin 30 gm');
    expect(popover).toHaveTextContent('In stock · 3 tube · 90 g');
    const quantity = within(popover).getByTestId(`${P}-quantity`);
    expect(quantity).toHaveValue('1');
    await waitFor(() => expect(quantity).toHaveFocus());
    expect(within(popover).getByTestId(`${P}-after`)).toHaveTextContent(
      'After · 2 tube · 60 g',
    );
    expect(within(popover).getByTestId(`${P}-mode`)).toHaveTextContent('tubeg');
    expect(popover).toHaveTextContent('1 tube = 30 g');
    expect(await axeForDialog(popover)).toHaveNoViolations();

    await user.click(within(popover).getByTestId(`${P}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(logStockMovement).toHaveBeenCalledWith({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        type: 'used',
        quantityMilli: 1000,
        usedFor: null,
        note: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      '1 tube of Soframycin 30 gm used · 2 tube left',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    undoOf()();
    await waitFor(() =>
      expect(revertStockMovement).toHaveBeenCalledWith({
        input: {
          itemId: TEST_STOCK_ITEM_ID,
          movementId: MOVEMENT_ID,
          reason: 'mistake',
          note: null,
        },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('an Undo refused — undone already — says so in the room’s words', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(usedMovement(-1000, 2000));
    vi.mocked(revertStockMovement).mockRejectedValue(conflict('already_reverted'));
    const { popover, onClose } = await openFor();
    await user.click(within(popover).getByTestId(`${P}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    undoOf()();
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        wordsOf(STOCK_DRAWER_KEYS.confirm.revert.blocked.alreadyReverted),
      ),
    );
  });

  it('a use the shelf no longer holds (`409 not_enough_stock`) stays open and says why', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockRejectedValue(conflict('not_enough_stock'));
    const { popover, onClose } = await openFor();
    await user.click(within(popover).getByTestId(`${P}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        wordsOf(STOCK_DRAWER_KEYS.movement.notEnoughStock),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
    expect(within(popover).getByTestId(`${P}-quantity`)).toHaveValue('1');
  });

  it('steps half a tube, picks a quick chip, and stops at what is in stock', async () => {
    const user = setup();
    const { popover } = await openFor();
    const quantity = within(popover).getByTestId(`${P}-quantity`);
    await user.click(within(popover).getByTestId(`${P}-more`));
    expect(quantity).toHaveValue('1.5');
    await user.click(within(popover).getByTestId(`${P}-less`));
    await user.click(within(popover).getByTestId(`${P}-less`));
    expect(quantity).toHaveValue('0.5');
    await user.click(within(popover).getByTestId(`${P}-quick-2`));
    expect(within(popover).getByTestId(`${P}-quick-2`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(popover).getByTestId(`${P}-save`)).toHaveTextContent('Use 2 tube');

    await user.clear(quantity);
    await user.type(quantity, '4');
    expect(within(popover).getByRole('alert')).toHaveTextContent(
      'Only 3 tube · 90 g in stock',
    );
    expect(within(popover).getByTestId(`${P}-save`)).toBeDisabled();

    await user.clear(quantity);
    expect(within(popover).getByTestId(`${P}-save`)).toHaveTextContent(
      'Enter a quantity',
    );
    expect(within(popover).getByTestId(`${P}-save`)).toBeDisabled();
    expect(logStockMovement).not.toHaveBeenCalled();
  });

  it('counts in grams — the figure in its remark — with what it was for, and Enter saves', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(usedMovement(-500, 2500));
    const { popover, onClose } = await openFor();
    await user.click(within(popover).getByRole('radio', { name: 'g' }));
    const quantity = within(popover).getByTestId(`${P}-quantity`);
    expect(quantity).toHaveValue('10');
    // 1 · 5 · 10 · 25 — up to the 30 g contents; the measure steps 5.
    expect(within(popover).queryByTestId(`${P}-quick-50`)).not.toBeInTheDocument();
    await user.click(within(popover).getByTestId(`${P}-more`));
    expect(quantity).toHaveValue('15');
    await user.click(within(popover).getByTestId(`${P}-used-for-Peel`));

    await user.type(quantity, '{Enter}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(logStockMovement).toHaveBeenCalledWith({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        type: 'used',
        quantityMilli: 500,
        usedFor: 'Peel',
        note: '15 g',
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      '15 g of Soframycin 30 gm used · 2.5 tube left',
      expect.anything(),
    );
  });

  it('"More details" hands the item to the Log usage drawer', async () => {
    const user = setup();
    const { popover, onMoreDetails, item } = await openFor();
    await user.click(within(popover).getByTestId(`${P}-more-details`));
    expect(onMoreDetails).toHaveBeenCalledWith(item);
  });

  it('an item without contents counts in units only', async () => {
    const { popover } = await openFor(
      stockItemRow({ sizePerUnit: null, measureUnit: null }),
    );
    expect(within(popover).queryByTestId(`${P}-mode`)).not.toBeInTheDocument();
    expect(popover).toHaveTextContent('In stock · 3 tube');
  });

  it('stays closed without an item or an anchor', () => {
    renderStockDrawer(
      <StockUsePopover
        item={null}
        anchor={null}
        onClose={vi.fn()}
        onMoreDetails={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(P)).not.toBeInTheDocument();
  });
});
