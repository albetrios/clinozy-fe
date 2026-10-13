import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../../shared/stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  revertStockMovement: vi.fn(),
}));
import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  stockMovementRow,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_MOVEMENT_ID,
  TEST_STOCK_PURCHASE_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import { ItemsPage } from '../../items/ItemsPage.tsx';
import { MovementsPage } from '../../movements/MovementsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { useStockAccess } from '../../shared/hooks/useStockAccess/index.ts';
import {
  fetchStockItem,
  fetchStockPurchase,
  fetchStockVendor,
} from '../../shared/stock-api.ts';
import { revertStockMovement } from '../../shared/stock-records-api.ts';
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

const rowOf = (tab: StockTestTab, text: string) => {
  const row = screen
    .getAllByTestId(`stock-${tab}-table-row`)
    .find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};
const action = (tab: StockTestTab, text: string, id: string) =>
  within(rowOf(tab, text)).getByTestId(`stock-${tab}-row-action-${id}`);

/** Open the room at `path` for a member and wait for `text` in the tab's rows and the access. */
async function openAt(
  path: string,
  tab: StockTestTab,
  text: string,
  permissions?: readonly OrganizationPermission[],
) {
  const view = renderStockRoutes(`${ROOM}/${path}`, PAGES, { permissions });
  await waitFor(() => expect(rowOf(tab, text)).toBeInTheDocument());
  await screen.findByTestId('access-resolved');
  return view;
}

/** A drawer is gone, or sliding out. */
const closed = (testId: string) =>
  (screen.queryByTestId(testId)?.getAttribute('data-state') ?? 'closed') === 'closed';

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  primeStockRoom();
});
afterEach(() => resetStockRoutes());

describe('Clinic stock — a drawer from each tab', () => {
  it('Items: a row opens Edit item from its own read; New item and Stock check open on their routes', async () => {
    const user = setup();
    const { router } = await openAt('items?q=sof', 'items', 'Soframycin');
    await user.click(within(rowOf('items', 'Soframycin')).getByText('Soframycin 30 gm'));
    const drawer = await screen.findByTestId('stock-item-drawer');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/items/${TEST_STOCK_ITEM_ID}/edit`,
      ),
    );
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-item-drawer-tag')).toHaveTextContent(
        '#167',
      ),
    );
    expect(fetchStockItem).toHaveBeenCalledWith(TEST_STOCK_ITEM_ID);
    expect(within(drawer).getByTestId('stock-item-drawer-save')).toBeInTheDocument();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId('stock-item-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/items`));
    expect(router.state.location.search).toMatchObject({ q: 'sof' });

    await user.click(screen.getByTestId('stock-items-new'));
    const created = await screen.findByTestId('stock-item-drawer');
    expect(within(created).getByTestId('stock-item-drawer-title')).toHaveTextContent(
      'New item',
    );
    expect(router.state.location.pathname).toBe(`${ROOM}/items/create`);
    await user.click(within(created).getByTestId('stock-item-drawer-dismiss'));
    await waitFor(() => expect(closed('stock-item-drawer')).toBe(true));

    await user.click(screen.getByTestId('stock-items-view-action-check'));
    const check = await screen.findByTestId('stock-check-drawer');
    await waitFor(() =>
      expect(within(check).getByTestId('stock-check-drawer-counter')).toHaveTextContent(
        '0 of 3 counted',
      ),
    );
    expect(router.state.location.pathname).toBe(`${ROOM}/items/check`);
  });

  it('Items: Use opens the popover at the row; Receive stock opens the movement drawer', async () => {
    const user = setup();
    await openAt('items', 'items', 'Soframycin');
    await user.click(action('items', 'Soframycin', 'use'));
    expect(await screen.findByTestId('stock-use-popover')).toHaveAccessibleName(
      'Use Soframycin 30 gm',
    );
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByTestId('stock-use-popover')).not.toBeInTheDocument(),
    );

    await user.click(action('items', 'Soframycin', 'receive'));
    const drawer = await screen.findByTestId('stock-movement-drawer');
    expect(within(drawer).getByTestId('stock-movement-drawer-title')).toHaveTextContent(
      'Receive stock',
    );
  });

  it('Purchases: a row opens Edit purchase — its lines as received, Paid the server’s; New purchase from the toolbar', async () => {
    const user = setup();
    const { router } = await openAt('purchases', 'purchases', '#16');
    await user.click(within(rowOf('purchases', '#16')).getByText('Ankur Pharma'));
    const drawer = await screen.findByTestId('stock-purchase-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-purchase-drawer-tag')).toHaveTextContent(
        '#16',
      ),
    );
    expect(router.state.location.pathname).toBe(
      `${ROOM}/purchases/${TEST_STOCK_PURCHASE_ID}/edit`,
    );
    expect(fetchStockPurchase).toHaveBeenCalledWith(TEST_STOCK_PURCHASE_ID);
    await user.click(
      within(drawer).getByTestId('stock-purchase-drawer-step-items-trigger'),
    );
    expect(
      within(drawer).queryByTestId('stock-purchase-drawer-lines-add'),
    ).not.toBeInTheDocument();
    await user.click(
      within(drawer).getByTestId('stock-purchase-drawer-step-payment-trigger'),
    );
    expect(
      await within(drawer).findByTestId('stock-purchase-drawer-paid'),
    ).toHaveTextContent('₹892.50 paid · Partly paid');
    await user.click(within(drawer).getByTestId('stock-purchase-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/purchases`));

    await user.click(screen.getByTestId('stock-purchases-new'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    const created = await screen.findByTestId('stock-purchase-drawer');
    await waitFor(() =>
      expect(
        within(created).getByTestId('stock-purchase-drawer-title'),
      ).toHaveTextContent('New purchase'),
    );
  });

  it('Movements: Revert opens its confirm and reverts; “From purchase #16” opens Edit purchase', async () => {
    const user = setup();
    vi.mocked(revertStockMovement).mockResolvedValue(
      stockMovementRow({
        id: 'smov_reverting000000000000',
        kind: 'reverted',
        deltaMilli: 500,
        afterMilli: 3500,
        revertsId: TEST_STOCK_MOVEMENT_ID,
      }),
    );
    const { router } = await openAt('movements', 'movements', 'LHR');
    await user.click(action('movements', 'LHR', 'revert'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Revert this movement?');
    await user.click(within(confirm).getByRole('radio', { name: 'Logged by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Revert' }));
    await waitFor(() =>
      expect(revertStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            itemId: TEST_STOCK_ITEM_ID,
            movementId: TEST_STOCK_MOVEMENT_ID,
            reason: 'mistake',
          }),
          idempotencyKey: expect.any(String),
        }),
      ),
    );
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());

    await user.click(screen.getByTestId('stock-movements-purchase'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/purchases/${TEST_STOCK_PURCHASE_ID}/edit`,
      ),
    );
    const drawer = await screen.findByTestId('stock-purchase-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-purchase-drawer-tag')).toHaveTextContent(
        '#16',
      ),
    );
  });

  it('Vendors: a row opens Edit clinic vendor; New clinic vendor opens from the toolbar', async () => {
    const user = setup();
    const { router } = await openAt('vendors', 'vendors', 'Ankur Pharma');
    await user.click(within(rowOf('vendors', 'Ankur Pharma')).getByText('Ankur Pharma'));
    const drawer = await screen.findByTestId('stock-vendor-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-vendor-drawer-name')).toHaveValue(
        'Ankur Pharma',
      ),
    );
    expect(router.state.location.pathname).toBe(
      `${ROOM}/vendors/${TEST_STOCK_VENDOR_ID}/edit`,
    );
    expect(fetchStockVendor).toHaveBeenCalledWith(TEST_STOCK_VENDOR_ID);
    await user.click(within(drawer).getByTestId('stock-vendor-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/vendors`));

    await user.click(screen.getByTestId('stock-vendors-new'));
    const created = await screen.findByTestId('stock-vendor-drawer');
    expect(within(created).getByTestId('stock-vendor-drawer-name')).toHaveValue('');
    expect(router.state.location.pathname).toBe(`${ROOM}/vendors/create`);
  });
});

describe('Clinic stock drawers for a narrow member', () => {
  it('a member who may only look opens every record view only — no Save, no Delete', async () => {
    const viewer = STOCK_NARROW_CODES.viewer;
    /** Each record's route, its tab, a row to wait for, its drawer, and how it shows once read. */
    const records: [
      string,
      StockTestTab,
      string,
      string,
      (drawer: HTMLElement) => void,
    ][] = [
      [
        `items/${TEST_STOCK_ITEM_ID}/edit`,
        'items',
        'Soframycin',
        'stock-item-drawer',
        (drawer) =>
          expect(within(drawer).getByTestId('stock-item-drawer-tag')).toHaveTextContent(
            '#167',
          ),
      ],
      [
        `purchases/${TEST_STOCK_PURCHASE_ID}/edit`,
        'purchases',
        '#16',
        'stock-purchase-drawer',
        (drawer) =>
          expect(
            within(drawer).getByTestId('stock-purchase-drawer-tag'),
          ).toHaveTextContent('#16'),
      ],
      [
        `vendors/${TEST_STOCK_VENDOR_ID}/edit`,
        'vendors',
        'Ibreia',
        'stock-vendor-drawer',
        (drawer) =>
          expect(within(drawer).getByTestId('stock-vendor-drawer-name')).toHaveValue(
            'Ankur Pharma',
          ),
      ],
    ];
    for (const [path, tab, text, drawerId, loaded] of records) {
      const view = await openAt(path, tab, text, viewer);
      const drawer = await screen.findByTestId(drawerId);
      await waitFor(() => loaded(drawer));
      expect(within(drawer).queryByTestId(`${drawerId}-save`)).not.toBeInTheDocument();
      expect(within(drawer).queryByTestId(`${drawerId}-delete`)).not.toBeInTheDocument();
      view.unmount();
      resetStockRoutes();
    }
  });

  it('Therapist’s codes record a purchase, but without `payment:create` it has no Paid', async () => {
    const user = setup();
    await openAt('purchases/create', 'purchases', '#16', STOCK_NARROW_CODES.keeper);
    const drawer = await screen.findByTestId('stock-purchase-drawer');
    expect(within(drawer).getByTestId('stock-purchase-drawer-save')).toBeInTheDocument();
    await user.click(
      within(drawer).getByTestId('stock-purchase-drawer-step-payment-trigger'),
    );
    expect(
      within(drawer).queryByTestId('stock-purchase-drawer-paid'),
    ).not.toBeInTheDocument();
  });
});
