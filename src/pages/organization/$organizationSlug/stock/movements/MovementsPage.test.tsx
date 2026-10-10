import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStockMovements: vi.fn(),
  stockListSummary: vi.fn(),
  fetchAllStockItems: vi.fn(),
}));
vi.mock('../shared/stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  revertStockMovement: vi.fn(),
}));
import i18n from '@/lib/i18n/i18n.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { stockItemRow, stockMovementRow } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import {
  fetchAllStockItems,
  listStockMovements,
  stockListSummary,
} from '../shared/stock-api.ts';
import type { StockMovementRow } from '../shared/stock-contracts.ts';
import { revertStockMovement } from '../shared/stock-records-api.ts';
import { STOCK_KEYS, STOCK_NS } from '../stock.constants.ts';
import { MovementsPage } from './MovementsPage.tsx';

// The footer (its count) shows from `md`; a phone hides it.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
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

const MOVEMENTS_URL = '/organization/acme/stock/movements';
// Public ids as the URL takes them (`<prefix>_<21 [a-z0-9]>`).
const SOFRAMYCIN_ID = 'sitm_soframycin00000000000';
const GAUZE_ID = 'sitm_gauze0000000000000000';
const PURCHASE_ID = 'spur_billsixteen0000000000';
const USE_ID = 'smov_use000000000000000000';
const RECEIPT_ID = 'smov_receipt00000000000000';
const REVERT_ID = 'smov_revert000000000000000';
const ORPHAN_ID = 'smov_orphan000000000000000';

/** A word of the room as i18next answers it — the copy once merged, its key before. */
const word = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: STOCK_NS, ...options });

/**
 * The tab's four entries: a use reverted by a later entry, that revert, a
 * receipt from bill #16 and a damage on an item since deleted, logged by a
 * member who has left.
 */
const ROWS: StockMovementRow[] = [
  stockMovementRow({
    id: REVERT_ID,
    kind: 'reverted',
    deltaMilli: 500,
    afterMilli: 3000,
    usedFor: null,
    revertsId: USE_ID,
    revertReason: 'wrong_quantity',
    reverts: {
      movementId: USE_ID,
      kind: 'used',
      at: '2026-10-10T05:35:00.000Z',
      reason: 'wrong_quantity',
    },
  }),
  stockMovementRow({ reverted: true, revertedById: REVERT_ID }),
  stockMovementRow({
    id: RECEIPT_ID,
    kind: 'received',
    deltaMilli: 5000,
    afterMilli: 2500,
    usedFor: null,
    purchaseId: PURCHASE_ID,
    purchase: { id: PURCHASE_ID, seq: 16, billNo: 'INV-221' },
  }),
  stockMovementRow({
    id: ORPHAN_ID,
    itemId: GAUZE_ID,
    kind: 'damaged',
    deltaMilli: -1000,
    usedFor: null,
    note: 'Seal broken',
    item: null,
    by: null,
  }),
];

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const rows = () => screen.getAllByTestId('stock-movements-table-row');

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listStockMovements).mockResolvedValue({ rows: ROWS, next: null, total: 4 });
  vi.mocked(stockListSummary).mockResolvedValue({ total: 4, due: null });
  vi.mocked(fetchAllStockItems).mockResolvedValue([
    stockItemRow({ id: SOFRAMYCIN_ID }),
    stockItemRow({ id: GAUZE_ID, seq: 12, name: 'Gauze roll', category: 'consumables' }),
  ]);
});
afterEach(() => resetStockRoutes());

describe('MovementsPage (clinic-stock.md:57–71)', () => {
  it('lists the entries the API answers, newest first, counts them and has no search or create', async () => {
    const { container } = renderStockRoutes(MOVEMENTS_URL, { movements: MovementsPage });
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(listStockMovements).toHaveBeenCalledWith(
      { type: undefined, item: undefined, created: undefined },
      undefined,
    );
    // The revert says what it reverted and why; the original turns grey with its pill.
    expect(rows()[0]).toHaveTextContent('Reverted');
    expect(rows()[0]).toHaveTextContent(/Reverts used of .+ · Wrong quantity/);
    expect(rows()[0]).toHaveTextContent('+ 0.5 tube');
    expect(rows()[1]).toHaveTextContent('LHR · Dharti Galani');
    expect(within(rows()[1] as HTMLElement).getAllByText('Reverted')).toHaveLength(1);
    expect(rows()[1]).toHaveTextContent('− 0.5 tube');
    // A receipt names its purchase and its bill.
    expect(rows()[2]).toHaveTextContent(
      word(STOCK_KEYS.movements.purchaseBill, { seq: 16, billNo: 'INV-221' }),
    );
    // A deleted item: its name gone, the bare figure; a member who left: no avatar.
    expect(rows()[3]).toHaveTextContent(word(STOCK_KEYS.movements.deletedItem));
    expect(rows()[3]).toHaveTextContent('Seal broken');
    expect(rows()[3]).toHaveTextContent('− 1');
    await waitFor(() =>
      expect(screen.getByTestId('stock-movements-table-footer')).toHaveTextContent(
        '4 entries',
      ),
    );
    expect(stockListSummary).toHaveBeenCalledWith('movements', {
      type: undefined,
      item: undefined,
      created: undefined,
    });
    expect(screen.getByTestId('stock-movements-table-end')).toHaveTextContent(
      'All movements loaded',
    );
    expect(screen.queryByTestId('stock-movements-new')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the Item and Type filters from the URL', async () => {
    renderStockRoutes(`${MOVEMENTS_URL}?item=${SOFRAMYCIN_ID}&type=used&type=opening`, {
      movements: MovementsPage,
    });
    await waitFor(() =>
      expect(listStockMovements).toHaveBeenCalledWith(
        { type: ['used', 'opening'], item: SOFRAMYCIN_ID, created: undefined },
        undefined,
      ),
    );
    expect(
      await screen.findByTestId('stock-movements-filters-trigger'),
    ).toHaveTextContent('3');
  });

  it('filters by one item from the catalogue and by the fixed types', async () => {
    const user = setup();
    const { router } = renderStockRoutes(MOVEMENTS_URL, { movements: MovementsPage });
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(screen.getByTestId('stock-movements-filters-trigger'));
    const panel = await screen.findByTestId('stock-movements-filters');
    // Every type the API knows, whatever the rows hold — `opening` included.
    const types = within(panel).getByRole('group', {
      name: word(STOCK_KEYS.filters.type),
    });
    expect(within(types).getAllByRole('button')).toHaveLength(7);
    await user.click(
      within(types).getByRole('button', { name: word(STOCK_KEYS.movements.types.used) }),
    );
    // The item picker lists the catalogue, searchable; one item at a time.
    await user.click(
      within(panel).getByRole('button', {
        name: word(STOCK_KEYS.movements.itemFilter.any),
      }),
    );
    await user.type(
      within(panel).getByRole('searchbox', {
        name: word(STOCK_KEYS.movements.itemFilter.search),
      }),
      'gauze',
    );
    expect(within(panel).queryByRole('button', { name: /Soframycin/ })).toBeNull();
    await user.click(within(panel).getByRole('button', { name: /Gauze roll #12/ }));
    await user.click(within(panel).getByTestId('stock-movements-filters-apply'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        item: GAUZE_ID,
        type: ['used'],
      }),
    );
    await waitFor(() =>
      expect(listStockMovements).toHaveBeenLastCalledWith(
        { type: ['used'], item: GAUZE_ID, created: undefined },
        undefined,
      ),
    );
  });

  it('opens a receipt’s purchase from "From purchase #16 · bill INV-221"', async () => {
    const user = setup();
    const { router } = renderStockRoutes(`${MOVEMENTS_URL}?type=received`, {
      movements: MovementsPage,
    });
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(screen.getByTestId('stock-movements-purchase'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/stock/purchases/${PURCHASE_ID}/edit`,
      ),
    );
  });

  it('offers Revert on a change neither reverted nor a revert, its item still there', async () => {
    const user = setup();
    vi.mocked(revertStockMovement).mockResolvedValue(
      stockMovementRow({ id: 'smov_new000000000000000000', kind: 'reverted' }),
    );
    renderStockRoutes(MOVEMENTS_URL, { movements: MovementsPage });
    await waitFor(() => expect(rows()).toHaveLength(4));
    const offered = rows().map((row) =>
      within(row).queryByTestId('stock-movements-row-action-revert'),
    );
    expect(offered.map(Boolean)).toEqual([false, false, true, false]);
    await user.click(offered[2] as HTMLElement);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Revert this movement?');
    expect(dialog).toHaveTextContent('received of 5 tube Soframycin 30 gm');
  });

  it.each(['therapist', 'accountant'] as const)(
    'offers no Revert to a %s, who cannot move stock',
    async (role) => {
      renderStockRoutes(MOVEMENTS_URL, { movements: MovementsPage }, { role });
      await waitFor(() => expect(rows()).toHaveLength(4));
      expect(screen.queryByTestId('stock-movements-row-action-revert')).toBeNull();
    },
  );

  it('shows a first read that fails in place, with Retry', async () => {
    const user = setup();
    vi.mocked(listStockMovements).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/stock-item-movements', 'GET', {}),
    );
    renderStockRoutes(MOVEMENTS_URL, { movements: MovementsPage });
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() => expect(rows()).toHaveLength(4));
  });

  it('says so when no entry matches the filters', async () => {
    vi.mocked(listStockMovements).mockResolvedValue({ rows: [], next: null, total: 0 });
    vi.mocked(stockListSummary).mockResolvedValue({ total: 0, due: null });
    renderStockRoutes(`${MOVEMENTS_URL}?type=damaged`, { movements: MovementsPage });
    expect(await screen.findByText('No matches')).toBeInTheDocument();
  });
});
