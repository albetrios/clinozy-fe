import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
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

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

/** Confirm `target` with "Created by mistake"; resolve once the record is gone. */
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
  await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  return { onClose };
}

/** The Undo the toast offered. */
const undoOf = (call = 0) =>
  (notifyMock.undo.mock.calls[call] as [string, { onUndo: () => void }])[1].onUndo;

describe('StockDeleteConfirm (clinic-stock.md:289–301)', () => {
  it('a row deletes an item: "… removed" + Undo, which restores it', async () => {
    const id = ref.stockItem(167);
    await confirm(
      { kind: 'item', id, name: 'Soframycin 30 gm', from: 'row' },
      'Delete this item?',
    );
    expect(clinicFixtures.stockItems.snapshot((row) => row.id === id)).toEqual([]);
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Soframycin 30 gm removed',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    undoOf()();
    await waitFor(() =>
      expect(clinicFixtures.stockItems.snapshot((row) => row.id === id)).toHaveLength(1),
    );
  });

  it('the drawer deletes an item: "… deleted"', async () => {
    await confirm(
      { kind: 'item', id: ref.stockItem(163), name: 'Fucibet', from: 'drawer' },
      'Delete this item?',
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Fucibet deleted', expect.anything());
  });

  it('deletes a purchase by its number, its supplier in the pill', async () => {
    const id = ref.stockPurchase(15);
    await confirm(
      { kind: 'purchase', id, name: '#15', seq: 15, record: 'Cranix Pharma' },
      'Delete this purchase?',
    );
    expect(clinicFixtures.stockPurchases.snapshot((row) => row.id === id)).toEqual([]);
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Purchase #15 deleted',
      expect.anything(),
    );
    undoOf()();
    await waitFor(() =>
      expect(clinicFixtures.stockPurchases.snapshot((row) => row.id === id)).toHaveLength(
        1,
      ),
    );
  });

  it('deletes a clinic vendor nothing is owed', async () => {
    const id = ref.stockVendor(4);
    await confirm(
      { kind: 'vendor', id, name: 'Ibreia', from: 'row' },
      'Delete this clinic vendor?',
    );
    expect(clinicFixtures.stockVendors.snapshot((row) => row.id === id)).toEqual([]);
    undoOf()();
    await waitFor(() =>
      expect(clinicFixtures.stockVendors.snapshot((row) => row.id === id)).toHaveLength(
        1,
      ),
    );
  });

  it('stays closed without a target', () => {
    renderStockDrawer(<StockDeleteConfirm target={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
