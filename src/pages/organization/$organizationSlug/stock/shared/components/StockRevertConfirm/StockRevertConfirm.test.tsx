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
import { listStockMovements } from '../../stock-api.ts';
import type { StockChangeRow } from '../../stock-contracts.ts';
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

/** A Movements row as the tab lists it. */
async function changeRow(id: string): Promise<StockChangeRow> {
  const { items } = await listStockMovements();
  const row = items.find((candidate) => candidate.id === id);
  if (!row || row.kind === 'payment') throw new Error(`no stock change ${id}`);
  return row;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockRevertConfirm (clinic-stock.md:289–301)', () => {
  it('reverts a use for a reason: the stock goes back, both entries stay', async () => {
    const user = setup();
    const onClose = vi.fn();
    // Noprik: 1 tube used today, 5 left.
    const movement = await changeRow(ref.stockMovement(1));
    renderStockDrawer(<StockRevertConfirm movement={movement} onClose={onClose} />);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Revert this movement?');
    expect(dialog).toHaveTextContent('used of 1 tube Noprik Plus numbing cream 50 gm');
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
        'Used reverted · Noprik Plus numbing cream 50 gm back to 6 tube',
      ),
    );
    expect(
      clinicFixtures.stockMovements.snapshot((row) => row.revertsId === movement.id)[0],
    ).toMatchObject({ type: 'reverted', revertReason: 'wrong_qty', deltaMilli: 1000 });
  });

  it('"Other" sends what the team typed', async () => {
    const user = setup();
    // D-Tan Mask: 1 pack damaged.
    const movement = await changeRow(ref.stockMovement(4));
    renderStockDrawer(<StockRevertConfirm movement={movement} onClose={vi.fn()} />);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.type(within(dialog).getByRole('textbox'), 'Seal was fine');
    await user.click(within(dialog).getByRole('button', { name: 'Revert' }));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(
      clinicFixtures.stockMovements.snapshot((row) => row.revertsId === movement.id)[0],
    ).toMatchObject({ revertReason: 'other', usedFor: 'Seal was fine' });
  });

  it('stays closed without a movement', () => {
    renderStockDrawer(<StockRevertConfirm movement={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
