import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  revertStockMovement: vi.fn(),
}));
import i18n from '@/lib/i18n/i18n.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  stockMovementRow,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_MOVEMENT_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { STOCK_NS } from '../../../stock.constants.ts';
import type { StockMovementRecord, StockMovementRow } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../../stock-drawers.constants.ts';
import { revertStockMovement } from '../../stock-records-api.ts';
import { isRevertable, type StockRevertTarget } from './stock-revert-target.ts';
import { StockRevertConfirm } from './StockRevertConfirm.tsx';

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

/** A row the confirm can take. */
function revertTarget(row: StockMovementRow): StockRevertTarget {
  if (!isRevertable(row)) throw new Error(`${row.id} cannot be reverted`);
  return row;
}

/** Half a tube of Soframycin used for an LHR — 2.5 tubes left. */
const USE = revertTarget(stockMovementRow());

/** The Reverted entry clinozy-be answers: the half tube back, 3 tubes now. */
const REVERT: StockMovementRecord = {
  ...stockMovementRow({
    id: 'smov_revert000000000000000',
    kind: 'reverted',
    deltaMilli: 500,
    afterMilli: 3000,
    usedFor: null,
    revertsId: TEST_STOCK_MOVEMENT_ID,
  }),
};

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string, detail: string) =>
  new HttpError(detail, 409, '/app/stock-items/x/movements/y/revert', 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail },
  });

/** Open the confirm for a use, pick `reason` and press Revert. */
async function confirm(reason: string) {
  const user = setup();
  const onClose = vi.fn();
  renderStockDrawer(<StockRevertConfirm movement={USE} onClose={onClose} />);
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('radio', { name: reason }));
  await user.click(within(dialog).getByRole('button', { name: 'Revert' }));
  return { user, dialog, onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetStockRoutes());

describe('StockRevertConfirm (clinic-stock.md:289–301)', () => {
  it('asks why, reverts with the reason and says what is in stock now — no Undo', async () => {
    vi.mocked(revertStockMovement).mockResolvedValue(REVERT);
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockRevertConfirm movement={USE} onClose={onClose} />);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Revert this movement?');
    expect(dialog).toHaveTextContent('used of 0.5 tube Soframycin 30 gm');
    expect(dialog).toHaveTextContent(
      'Stock goes back to what it was before this entry. Both entries stay in the history.',
    );
    for (const reason of ['Logged by mistake', 'Wrong item', 'Wrong quantity', 'Other']) {
      expect(within(dialog).getByRole('radio', { name: reason })).toBeInTheDocument();
    }
    expect(await axeForDialog(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByRole('radio', { name: 'Wrong quantity' }));
    await user.click(within(dialog).getByRole('button', { name: 'Revert' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Used reverted · Soframycin 30 gm back to 3 tube',
      ),
    );
    expect(revertStockMovement).toHaveBeenCalledWith({
      input: {
        itemId: TEST_STOCK_ITEM_ID,
        movementId: TEST_STOCK_MOVEMENT_ID,
        reason: 'wrong_quantity',
        note: '',
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('"Other" sends what the team typed', async () => {
    vi.mocked(revertStockMovement).mockResolvedValue(REVERT);
    const user = setup();
    renderStockDrawer(<StockRevertConfirm movement={USE} onClose={vi.fn()} />);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.type(within(dialog).getByRole('textbox'), 'Seal was fine');
    await user.click(within(dialog).getByRole('button', { name: 'Revert' }));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(vi.mocked(revertStockMovement).mock.calls[0]?.[0].input).toMatchObject({
      reason: 'other',
      note: 'Seal was fine',
    });
  });

  it.each([
    [
      'already_reverted',
      'This movement was reverted before, or is itself a revert',
      STOCK_DRAWER_KEYS.confirm.revert.blocked.alreadyReverted,
    ],
    [
      'not_enough_stock',
      'Only 1 tube in stock — that would take it below zero',
      STOCK_DRAWER_KEYS.confirm.revert.blocked.notEnoughStock,
    ],
  ])(
    'a refused revert (409 %s) closes the confirm and says why',
    async (reason, detail, key) => {
      vi.mocked(revertStockMovement).mockRejectedValue(conflict(reason, detail));
      const { onClose } = await confirm('Logged by mistake');
      await waitFor(() =>
        expect(notifyMock.error).toHaveBeenCalledWith(i18n.t(key, { ns: STOCK_NS })),
      );
      expect(onClose).toHaveBeenCalled();
      expect(notifyMock.success).not.toHaveBeenCalled();
    },
  );

  it('keeps the confirm open on any other failure, with the error', async () => {
    vi.mocked(revertStockMovement).mockRejectedValue(
      new HttpError(
        'Server error',
        500,
        '/app/stock-items/x/movements/y/revert',
        'POST',
        {
          error: { type: 'api_error', code: 'internal_error', detail: 'Something broke' },
        },
      ),
    );
    const { onClose, dialog } = await confirm('Wrong item');
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it('stays closed without a movement', () => {
    renderStockDrawer(<StockRevertConfirm movement={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('isRevertable', () => {
  it('takes a change neither reverted nor a revert, its item still there', () => {
    expect(isRevertable(stockMovementRow())).toBe(true);
    expect(isRevertable(stockMovementRow({ kind: 'opening' }))).toBe(true);
    expect(isRevertable(stockMovementRow({ reverted: true }))).toBe(false);
    expect(isRevertable(stockMovementRow({ kind: 'reverted' }))).toBe(false);
    expect(isRevertable(stockMovementRow({ item: null }))).toBe(false);
  });
});
