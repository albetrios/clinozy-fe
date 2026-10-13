import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../../shared/stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStockItems: vi.fn(),
  listStockPurchases: vi.fn(),
  listStockMovements: vi.fn(),
  listStockVendors: vi.fn(),
  stockListSummary: vi.fn(),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
  fetchStockItem: vi.fn(),
  fetchStockPurchase: vi.fn(),
  fetchStockVendor: vi.fn(),
}));
import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Role } from '@/shared/api/app/app-schema.ts';

import { ItemsPage } from '../../items/ItemsPage.tsx';
import { MovementsPage } from '../../movements/MovementsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { useStockAccess } from '../../shared/hooks/useStockAccess/index.ts';
import {
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
} from '../../shared/stock-api.ts';
import { VendorsPage } from '../../vendors/VendorsPage.tsx';
import {
  primeStockRoom,
  STOCK_NARROW_CODES,
  STOCK_ROOM_URL as ROOM,
} from './stock-room-test-data.ts';
import {
  renderStockRoutes,
  resetStockRoutes,
  type StockTestTab,
} from './stock-test-router.tsx';

// The footers (their counts) show from `md`; a phone hides them.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A tab page with a mark once the member's access is known — the gates' answers are final then. */
const withAccess = (Page: () => ReactNode) =>
  function TabWithAccess() {
    const { resolved } = useStockAccess();
    return (
      <>
        {resolved ? <span data-testid="access-resolved" hidden /> : null}
        <Page />
      </>
    );
  };

const PAGES = {
  items: withAccess(ItemsPage),
  purchases: withAccess(PurchasesPage),
  movements: withAccess(MovementsPage),
  vendors: withAccess(VendorsPage),
};
const ROW_COUNTS: Record<StockTestTab, number> = {
  items: 3,
  purchases: 2,
  movements: 2,
  vendors: 3,
};

const rows = (tab: StockTestTab) => screen.getAllByTestId(`stock-${tab}-table-row`);
const rowOf = (tab: StockTestTab, text: string) => {
  const row = rows(tab).find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};
/** A row's action buttons, by id. */
const actionsOf = (tab: StockTestTab, text: string) =>
  within(rowOf(tab, text))
    .queryAllByTestId(/-row-action-/)
    .map((button) => button.dataset.testid?.split('-row-action-')[1]);

/** Open a tab for a member and wait for its rows and the member's access. */
async function openTab(
  tab: StockTestTab,
  member: { permissions?: readonly OrganizationPermission[]; role?: Role } = {},
  query = '',
) {
  const view = renderStockRoutes(`${ROOM}/${tab}${query}`, PAGES, member);
  await waitFor(() => expect(rows(tab)).toHaveLength(ROW_COUNTS[tab]));
  await screen.findByTestId('access-resolved');
  return view;
}

/** Select every row of the tab and say whether the bulk bar offers Export. */
async function exportOffered(tab: StockTestTab) {
  const user = setup();
  await user.click(screen.getByTestId(`stock-${tab}-table-select-all`));
  await screen.findByTestId(`stock-${tab}-table-bulk-bar`);
  return screen.queryByTestId(`stock-${tab}-table-bulk-export`) !== null;
}

beforeEach(() => {
  vi.resetAllMocks();
  primeStockRoom();
});
afterEach(() => resetStockRoutes());

describe('Clinic stock on clinozy-be — the four tabs', () => {
  it('Items: the API’s rows with the server’s level and runway, searched by name or #ID', async () => {
    const { container } = await openTab('items', {}, '?q=sofra&stock=low');
    expect(listStockItems).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'sofra', stock: 'low' }),
      undefined,
    );
    const soframycin = rowOf('items', 'Soframycin 30 gm');
    expect(soframycin).toHaveTextContent('#167');
    expect(soframycin).toHaveTextContent('3 tube · 90 g · OK');
    expect(soframycin).toHaveTextContent('~6 weeks');
    expect(rowOf('items', 'D-Tan Mask')).toHaveTextContent('Low');
    expect(rowOf('items', 'Cotton roll')).toHaveTextContent('No usage');
    expect(screen.getByPlaceholderText('Search item name or #ID…')).toHaveValue('sofra');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Purchases: each bill with what is due in rupees, the footer’s due, searched by invoice, #ID or supplier', async () => {
    await openTab('purchases', {}, '?status=unpaid');
    expect(listStockPurchases).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['unpaid'] }),
      undefined,
    );
    expect(rowOf('purchases', '#16')).toHaveTextContent('Ankur Pharma');
    expect(rowOf('purchases', '#16')).toHaveTextContent('₹2,392.50');
    expect(rowOf('purchases', '#15')).toHaveTextContent('Unpaid');
    await waitFor(() =>
      expect(screen.getByTestId('stock-purchases-table-footer')).toHaveTextContent(
        '2 purchases · ₹3,210 due',
      ),
    );
    expect(
      screen.getByPlaceholderText('Search invoice, #ID or supplier…'),
    ).toBeInTheDocument();
  });

  it('Movements: every entry with its item and author, the footer’s count — and no search', async () => {
    await openTab('movements', {}, '?type=used,received');
    expect(listStockMovements).toHaveBeenCalledWith(
      expect.objectContaining({ type: ['used', 'received'] }),
      undefined,
    );
    const used = rowOf('movements', 'LHR · Dharti Galani');
    expect(used).toHaveTextContent('Soframycin 30 gm');
    expect(used).toHaveTextContent('Dr. Nisha Shah');
    expect(rowOf('movements', 'From purchase #16')).toHaveTextContent('bill INV-221');
    await waitFor(() =>
      expect(screen.getByTestId('stock-movements-table-footer')).toHaveTextContent(
        '2 entries',
      ),
    );
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-movements-new')).not.toBeInTheDocument();
  });

  it('Vendors: what each is owed over how many purchases, the footer’s payable, searched by name', async () => {
    await openTab('vendors', {}, '?q=an');
    expect(listStockVendors).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'an' }),
      undefined,
    );
    expect(rowOf('vendors', 'Ankur Pharma')).toHaveTextContent('₹1,500');
    expect(rowOf('vendors', 'Cranix Pharma')).toHaveTextContent('₹1,710');
    await waitFor(() =>
      expect(screen.getByTestId('stock-vendors-table-footer')).toHaveTextContent(
        '3 vendors · ₹3,210 payable',
      ),
    );
    expect(screen.getByPlaceholderText('Search vendor name…')).toHaveValue('an');
  });

  it('the tab row moves through the four tabs, each reading its own list', async () => {
    const user = setup();
    const { router } = await openTab('items');
    const steps: [StockTestTab, StockTestTab][] = [
      ['items', 'purchases'],
      ['purchases', 'movements'],
      ['movements', 'vendors'],
      ['vendors', 'items'],
    ];
    for (const [from, to] of steps) {
      await user.click(screen.getByTestId(`stock-${from}-tab-${to}`));
      await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/${to}`));
      await waitFor(() => expect(rows(to)).toHaveLength(ROW_COUNTS[to]));
      expect(screen.getByRole('link', { current: 'page' }).dataset.testid).toBe(
        `stock-${to}-tab-${to}`,
      );
    }
  });
});

describe('Clinic stock gates — the member’s own codes (api-integration §5.6 Roles)', () => {
  it('an Admin’s codes: every create, Stock check, every move and Delete, and Export', async () => {
    await openTab('items');
    expect(screen.getByTestId('stock-items-new')).toBeInTheDocument();
    expect(screen.getByTestId('stock-items-view-action-check')).toBeInTheDocument();
    expect(actionsOf('items', 'Soframycin')).toEqual([
      'use',
      'receive',
      'log',
      'adjust',
      'edit',
      'delete',
    ]);
    expect(await exportOffered('items')).toBe(true);
  });

  it('a member who may only look (`stock_item:read`): no create, move, Revert, Delete or Export on any tab', async () => {
    const viewer = { permissions: STOCK_NARROW_CODES.viewer };
    const items = await openTab('items', viewer);
    expect(screen.queryByTestId('stock-items-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-items-view-action-check')).not.toBeInTheDocument();
    expect(actionsOf('items', 'Soframycin')).toEqual(['edit']);
    expect(await exportOffered('items')).toBe(false);
    items.unmount();
    resetStockRoutes();

    const purchases = await openTab('purchases', viewer);
    expect(screen.queryByTestId('stock-purchases-new')).not.toBeInTheDocument();
    expect(actionsOf('purchases', '#15')).toEqual(['edit']);
    purchases.unmount();
    resetStockRoutes();

    const movements = await openTab('movements', viewer);
    expect(screen.queryByTestId('stock-movements-row-action-revert')).toBeNull();
    movements.unmount();
    resetStockRoutes();

    await openTab('vendors', viewer);
    expect(screen.queryByTestId('stock-vendors-new')).not.toBeInTheDocument();
    expect(actionsOf('vendors', 'Ibreia')).toEqual(['edit']);
  });

  it('Therapist’s codes (read · create · update) keep the stock, but delete and export nothing', async () => {
    const keeper = { permissions: STOCK_NARROW_CODES.keeper };
    const items = await openTab('items', keeper);
    expect(screen.getByTestId('stock-items-new')).toBeInTheDocument();
    expect(screen.getByTestId('stock-items-view-action-check')).toBeInTheDocument();
    expect(actionsOf('items', 'Soframycin')).toEqual([
      'use',
      'receive',
      'log',
      'adjust',
      'edit',
    ]);
    expect(await exportOffered('items')).toBe(false);
    items.unmount();
    resetStockRoutes();

    const movements = await openTab('movements', keeper);
    expect(actionsOf('movements', 'LHR · Dharti Galani')).toEqual(['revert']);
    movements.unmount();
    resetStockRoutes();

    await openTab('vendors', keeper);
    expect(screen.getByTestId('stock-vendors-new')).toBeInTheDocument();
    expect(actionsOf('vendors', 'Ibreia')).toEqual(['edit']);
  });

  it('an Accountant reads the stock and changes nothing', async () => {
    await openTab('items', { role: 'accountant' });
    expect(screen.queryByTestId('stock-items-new')).not.toBeInTheDocument();
    expect(actionsOf('items', 'Soframycin')).toEqual(['edit']);
  });
});
