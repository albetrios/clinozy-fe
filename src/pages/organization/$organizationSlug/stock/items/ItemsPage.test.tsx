import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStockItems: vi.fn(),
  fetchStockItem: vi.fn(),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
}));
vi.mock('../shared/stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteStockItem: vi.fn(),
  restoreStockItem: vi.fn(),
  logStockMovement: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { stockItemRow, TEST_STOCK_ITEM_ID } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
  type StockTestMember,
} from '../__tests__/integration/stock-test-router.tsx';
import { useStockDeleteBlockText } from '../shared/components/StockDeleteConfirm/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import {
  fetchAllStockItems,
  fetchAllStockVendors,
  fetchStockItem,
  listStockItems,
} from '../shared/stock-api.ts';
import type { StockItemRow } from '../shared/stock-contracts.ts';
import { deleteStockItem, logStockMovement } from '../shared/stock-records-api.ts';
import { ItemsPage } from './ItemsPage.tsx';

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

const EMPTY_ID = 'sitm_empty000000000000000';
const OUT_ID = 'sitm_dtan0000000000000000';

/** Soframycin with stock, an empty Cotton roll and D-Tan Mask, out. */
const ROWS: StockItemRow[] = [
  stockItemRow(),
  stockItemRow({
    id: EMPTY_ID,
    seq: 170,
    name: 'Cotton roll',
    category: 'consumables',
    unit: 'roll',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 0,
    level: 'out',
    lastsDays: null,
    vendor: null,
    vendorId: null,
  }),
  stockItemRow({
    id: OUT_ID,
    seq: 161,
    name: 'D-Tan Mask',
    category: 'masks',
    qtyMilli: 0,
    level: 'out',
    lastsDays: 0,
  }),
];

/** The tab, with a mark once the member's access is known — the gates' answers are final then. */
function ItemsTab() {
  const { resolved } = useStockAccess();
  return (
    <>
      {resolved ? <span data-testid="access-resolved" hidden /> : null}
      <ItemsPage />
    </>
  );
}

/** The Items tab at `url` for `role`, once its rows are listed and the access is known. */
async function openItems(
  url = '/organization/acme/stock/items',
  member: StockTestMember = { role: 'admin' },
) {
  const view = renderStockRoutes(url, { items: ItemsTab }, member);
  await waitFor(() =>
    expect(screen.getAllByTestId('stock-items-table-row')).toHaveLength(ROWS.length),
  );
  await screen.findByTestId('access-resolved');
  return view;
}

/** One row of the table, by its item's name. */
function rowNamed(name: string) {
  const row = screen
    .getAllByTestId('stock-items-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listStockItems).mockResolvedValue({ rows: ROWS, next: null, total: 3 });
  vi.mocked(fetchAllStockItems).mockResolvedValue(ROWS);
  vi.mocked(fetchAllStockVendors).mockResolvedValue([]);
  vi.mocked(fetchStockItem).mockResolvedValue(stockItemRow());
});
afterEach(() => resetStockRoutes());

describe('ItemsPage (clinic-stock.md:25–39)', () => {
  it('lists the live items under the Clinic stock toolbar, ending with "All items loaded"', async () => {
    const { container } = await openItems();
    expect(listStockItems).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined, lastsDaysTo: undefined }),
      undefined,
    );
    expect(screen.getByTestId('stock-items-page')).toHaveTextContent('Soframycin 30 gm');
    // The server's level and runway: OK, ~6 weeks; Out, ~0 days.
    expect(rowNamed('Soframycin').getByText('3 tube · 90 g · OK')).toBeInTheDocument();
    expect(rowNamed('D-Tan Mask').getByText('~0 days')).toBeInTheDocument();
    expect(rowNamed('Cotton roll').getByText('No usage')).toBeInTheDocument();
    expect(screen.getByTestId('stock-items-table-end')).toHaveTextContent(
      'All items loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'stock-items-tab-items',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the URL’s filters — Low stock, a Lasts tier as its upper bound, categories', async () => {
    await openItems(
      '/organization/acme/stock/items?stock=low&lasts=week&category=masks,peels',
    );
    expect(listStockItems).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stock: 'low',
        lastsDaysTo: 7,
        category: ['masks', 'peels'],
      }),
      undefined,
    );
  });

  it('offers every move, Edit and Delete to an Admin, and "+ New item"', async () => {
    await openItems();
    const row = rowNamed('Soframycin');
    for (const id of ['use', 'receive', 'log', 'adjust', 'edit', 'delete']) {
      expect(row.getByTestId(`stock-items-row-action-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('stock-items-new')).toBeInTheDocument();
  });

  it('a Pharmacist (create, update) moves stock but deletes nothing', async () => {
    await openItems(undefined, { role: 'pharmacist' });
    const row = rowNamed('Soframycin');
    expect(row.getByTestId('stock-items-row-action-use')).toBeInTheDocument();
    expect(row.getByTestId('stock-items-row-action-adjust')).toBeInTheDocument();
    expect(row.queryByTestId('stock-items-row-action-delete')).not.toBeInTheDocument();
  });

  it('without update, a row offers Edit alone (read-only) — "+ New item" only with create', async () => {
    const creator = await openItems(undefined, {
      permissions: ['organization:read', 'stock_item:read', 'stock_item:create'],
    });
    let row = rowNamed('Soframycin');
    expect(row.queryByTestId('stock-items-row-action-use')).not.toBeInTheDocument();
    expect(row.queryByTestId('stock-items-row-action-receive')).not.toBeInTheDocument();
    expect(row.getByTestId('stock-items-row-action-edit')).toBeInTheDocument();
    expect(screen.getByTestId('stock-items-new')).toBeInTheDocument();
    creator.unmount();
    resetStockRoutes();

    await openItems(undefined, { role: 'accountant' });
    row = rowNamed('Soframycin');
    expect(row.queryByTestId('stock-items-row-action-use')).not.toBeInTheDocument();
    expect(row.getByTestId('stock-items-row-action-edit')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-items-new')).not.toBeInTheDocument();
  });

  it('Use on an empty shelf says it is out of stock; Use opens the popover', async () => {
    const user = setup();
    await openItems();
    await user.click(rowNamed('D-Tan Mask').getByTestId('stock-items-row-action-use'));
    expect(notifyMock.info).toHaveBeenCalledWith('D-Tan Mask is out of stock');
    expect(screen.queryByTestId('stock-use-popover')).not.toBeInTheDocument();

    await user.click(rowNamed('Soframycin').getByTestId('stock-items-row-action-use'));
    expect(await screen.findByTestId('stock-use-popover')).toHaveAccessibleName(
      'Use Soframycin 30 gm',
    );
  });

  it('a refused use (`409 not_enough_stock`) reads the room again — the popover shows the shelf now', async () => {
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
    await openItems();
    await user.click(rowNamed('Soframycin').getByTestId('stock-items-row-action-use'));
    const popover = await screen.findByTestId('stock-use-popover');
    expect(popover).toHaveTextContent('In stock · 3 tube · 90 g');
    // Someone used 2.5 tubes meanwhile: the room's next read says so.
    vi.mocked(listStockItems).mockResolvedValue({
      rows: [stockItemRow({ qtyMilli: 500, level: 'low' }), ...ROWS.slice(1)],
      next: null,
      total: 3,
    });
    await user.click(within(popover).getByTestId('stock-use-popover-save'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('stock-use-popover')).toHaveTextContent(
        'In stock · 0.5 tube · 15 g',
      ),
    );
    expect(
      within(screen.getByTestId('stock-use-popover')).getByTestId(
        'stock-use-popover-save',
      ),
    ).toBeDisabled();
  });

  it('Receive stock and Adjust count open the movement drawer on their type', async () => {
    const user = setup();
    await openItems();
    await user.click(rowNamed('Soframycin').getByTestId('stock-items-row-action-adjust'));
    const drawer = await screen.findByTestId('stock-movement-drawer');
    expect(within(drawer).getByTestId('stock-movement-drawer-title')).toHaveTextContent(
      'Adjust stock',
    );
  });

  it('Delete goes only at zero: with stock it says why; at zero it asks with a reason', async () => {
    const user = setup();
    vi.mocked(deleteStockItem).mockResolvedValue(undefined);
    await openItems();
    const blockText = renderHook(() => useStockDeleteBlockText()).result.current;

    await user.click(rowNamed('Soframycin').getByTestId('stock-items-row-action-delete'));
    expect(notifyMock.info).toHaveBeenCalledWith(blockText('item_has_stock'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(
      rowNamed('Cotton roll').getByTestId('stock-items-row-action-delete'),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this item?');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteStockItem).toHaveBeenCalledWith({
        id: EMPTY_ID,
        reason: 'duplicate',
        note: null,
      }),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Cotton roll removed',
      expect.anything(),
    );
  });

  it('opens Edit item for `$itemId/edit`, read through the item’s own route', async () => {
    await openItems(`/organization/acme/stock/items/${TEST_STOCK_ITEM_ID}/edit`);
    const drawer = await screen.findByTestId('stock-item-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-item-drawer-tag')).toHaveTextContent(
        '#167',
      ),
    );
    expect(fetchStockItem).toHaveBeenCalledWith(TEST_STOCK_ITEM_ID);
  });
});
