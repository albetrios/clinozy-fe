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
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { stockItemRow, TEST_STOCK_ITEM_ID } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import type { StockItemRow, StockMovementRecord } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { logStockMovement, revertStockMovement } from '../../stock-records-api.ts';
import type { StockMovementInputType } from '../../stock-records-contracts.ts';
import { StockMovementDrawer } from './StockMovementDrawer.tsx';

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

const D = 'stock-movement-drawer';
const MOVEMENT_ID = 'smov_moved000000000000000';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A saved movement as the API answers it: its type, change and what it left (×1000). */
const savedMovement = (
  kind: StockMovementInputType,
  deltaMilli: number,
  afterMilli: number,
): StockMovementRecord => ({
  id: MOVEMENT_ID,
  itemId: TEST_STOCK_ITEM_ID,
  kind,
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

/** The input the drawer handed `logStockMovement`. */
const sentInput = () => vi.mocked(logStockMovement).mock.calls.at(-1)?.[0].input;

/** Open the drawer for `item` (Soframycin, 3 tubes of 30 g) as the row action `type` would. */
async function openFor(
  type: StockMovementInputType,
  item: StockItemRow = stockItemRow(),
) {
  const onClose = vi.fn();
  renderStockDrawer(
    <StockMovementDrawer item={item} type={type} open onClose={onClose} />,
  );
  return { drawer: await screen.findByTestId(D), onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetStockRoutes());

describe('StockMovementDrawer (clinic-stock.md:126–140, 233–245)', () => {
  it('Receive stock: the item now, the stock after it, a save — "… left" the server’s — and Undo', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(savedMovement('received', 2000, 5000));
    vi.mocked(revertStockMovement).mockResolvedValue(
      savedMovement('received', -2000, 3000),
    );
    const { drawer, onClose } = await openFor('received');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Receive stock');
    expect(drawer).toHaveTextContent(
      `${fsi('Soframycin 30 gm')} · ${fsi('3 tube · 90 g')} now`,
    );
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'ReceivedAfter: 4 tube · 120 g',
    );
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('1');
    // Used for is a use's only.
    expect(within(drawer).queryByTestId(`${D}-step-details`)).not.toBeInTheDocument();
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-quick-2`));
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'After: 5 tube · 150 g',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(logStockMovement).toHaveBeenCalledWith({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        type: 'received',
        quantityMilli: 2000,
        usedFor: null,
        note: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Received saved · 5 tube left',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
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
  });

  it('an Undo of a receipt used since (`409 not_enough_stock`) says it can’t go back', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(savedMovement('received', 1000, 4000));
    vi.mocked(revertStockMovement).mockRejectedValue(
      new HttpError('refused', 409, '/app/stock-items/x/movements/y/revert', 'POST', {
        error: {
          type: 'request_error',
          code: 'conflict',
          reason: 'not_enough_stock',
          detail: 'Only 0.5 tube in stock — that would take it below zero',
        },
      }),
    );
    const { drawer, onClose } = await openFor('received');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    const words = renderHook(() => useTranslation(STOCK_DRAWERS_NS)).result.current.t;
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        words(STOCK_DRAWER_KEYS.confirm.revert.blocked.notEnoughStock),
      ),
    );
  });

  it('Log usage refuses no quantity and more than the shelf holds', async () => {
    const user = setup();
    const { drawer, onClose } = await openFor('used');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Log usage');
    const quantity = within(drawer).getByTestId(`${D}-quantity`);

    await user.clear(quantity);
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter a quantity');

    await user.type(quantity, '4');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Soframycin 30 gm · −4 tube',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Only 3 tube · 90 g in stock');
    expect(onClose).not.toHaveBeenCalled();
    expect(logStockMovement).not.toHaveBeenCalled();
  });

  it('a use the shelf no longer holds (`409 not_enough_stock`) keeps the drawer, said in the room’s words', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockRejectedValue(
      new HttpError('refused', 409, '/app/stock-items/x/movements', 'POST', {
        error: {
          type: 'request_error',
          code: 'conflict',
          reason: 'not_enough_stock',
          detail: 'Only 0.5 tube in stock — that would take it below zero',
        },
      }),
    );
    const { drawer, onClose } = await openFor('used');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    const words = renderHook(() => useTranslation(STOCK_DRAWERS_NS)).result.current.t;
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        words(STOCK_DRAWER_KEYS.movement.notEnoughStock),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save movement');
  });

  it('Adjust starts from the shelf as the counted quantity, ± in the summary', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(savedMovement('adjust', -2500, 500));
    const { drawer, onClose } = await openFor('adjust');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Adjust stock');
    expect(drawer).toHaveTextContent('Counted quantity');
    const quantity = within(drawer).getByTestId(`${D}-quantity`);
    expect(quantity).toHaveValue('3');

    await user.clear(quantity);
    await user.type(quantity, '0.5');
    // At or below the minimum, the After pill turns butter.
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'After: 0.5 tube · 15 g',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Soframycin 30 gm · ±0.5 tube',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Adjust sends the counted quantity; the server writes the difference.
    expect(sentInput()).toEqual({
      itemId: TEST_STOCK_ITEM_ID,
      type: 'adjust',
      quantityMilli: 500,
      usedFor: null,
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Adjust saved · 0.5 tube left',
      expect.anything(),
    );
  });

  it('switching the type retitles the drawer, starts its quantity again and drops Used for', async () => {
    const user = setup();
    const { drawer } = await openFor('used');
    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-used-for-LHR`));
    await user.click(within(drawer).getByTestId(`${D}-step-movement-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-type-adjust`));
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Adjust stock');
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('3');
    expect(within(drawer).queryByTestId(`${D}-step-details`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-type-received`));
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Receive stock');
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('1');

    vi.mocked(logStockMovement).mockResolvedValue(savedMovement('received', 1000, 4000));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(logStockMovement).toHaveBeenCalled());
    // The use's "LHR" went with the type — a receipt says what it was for nowhere.
    expect(sentInput()).toMatchObject({ type: 'received', usedFor: null, note: null });
  });

  it('counts in the measure — the figure in the remark — with what it was used for', async () => {
    const user = setup();
    vi.mocked(logStockMovement).mockResolvedValue(savedMovement('used', -833, 2167));
    const { drawer, onClose } = await openFor('used');
    await user.click(within(drawer).getByTestId(`${D}-mode-measure`));
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('10');
    // 1 · 5 · 10 · 25 up to the 30 g contents.
    expect(within(drawer).queryByTestId(`${D}-quick-50`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-quick-25`));
    expect(within(drawer).getByTestId(`${D}-mode-measure`)).toHaveTextContent(
      'g (1 tube = 30 g)',
    );

    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-used-for-LHR`));
    await user.click(within(drawer).getByTestId(`${D}-step-notes-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-note`), 'Dharti Galani');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentInput()).toEqual({
      itemId: TEST_STOCK_ITEM_ID,
      type: 'used',
      quantityMilli: 833,
      usedFor: 'LHR',
      note: '25 g · Dharti Galani',
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Used saved · 2.17 tube left',
      expect.anything(),
    );
  });

  it('renders nothing without an item', () => {
    renderStockDrawer(
      <StockMovementDrawer item={null} type="used" open onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
  });
});
