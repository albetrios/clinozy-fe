import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStockPurchases: vi.fn(),
  stockListSummary: vi.fn(),
  fetchStockPurchase: vi.fn(),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
}));
vi.mock('../shared/stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteStockPurchase: vi.fn(),
  restoreStockPurchase: vi.fn(),
}));
import i18n from '@/lib/i18n/i18n.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import {
  stockItemRow,
  stockPurchaseRow,
  stockVendorRow,
  TEST_STOCK_PURCHASE_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import {
  fetchAllStockItems,
  fetchAllStockVendors,
  fetchStockPurchase,
  listStockPurchases,
  stockListSummary,
} from '../shared/stock-api.ts';
import { STOCK_DRAWER_KEYS } from '../shared/stock-drawers.constants.ts';
import { deleteStockPurchase } from '../shared/stock-records-api.ts';
import { STOCK_KEYS, STOCK_NS } from '../stock.constants.ts';
import { PurchasesPage } from './PurchasesPage.tsx';

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

const PURCHASES_URL = '/organization/acme/stock/purchases';
// Public ids as the URL takes them (`<prefix>_<21 [a-z0-9]>`).
const UNPAID_ID = 'spur_billfifteen0000000000';
const CRANIX_ID = 'svnd_cranix000000000000000';

/** A word of the room as i18next answers it — the copy once merged, its key before. */
const word = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: STOCK_NS, ...options });

/** Bill #16 from Ankur Pharma, partly paid, and #15 from Cranix Pharma, nothing paid. */
const ROWS = [
  stockPurchaseRow(),
  stockPurchaseRow({
    id: UNPAID_ID,
    seq: 15,
    vendorId: CRANIX_ID,
    billNo: 'CX-118',
    bill: 1710,
    paid: 0,
    due: 1710,
    status: 'unpaid',
    paymentIds: [],
    vendor: { id: CRANIX_ID, name: 'Cranix Pharma', phone: null },
  }),
];

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const rows = () => screen.getAllByTestId('stock-purchases-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row with ${text}`);
  return row;
};

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listStockPurchases).mockResolvedValue({ rows: ROWS, next: null, total: 2 });
  vi.mocked(stockListSummary).mockResolvedValue({ total: 2, due: 3210 });
  vi.mocked(fetchAllStockItems).mockResolvedValue([stockItemRow()]);
  vi.mocked(fetchAllStockVendors).mockResolvedValue([
    stockVendorRow(),
    stockVendorRow({ id: CRANIX_ID, name: 'Cranix Pharma', phone: null }),
  ]);
  vi.mocked(fetchStockPurchase).mockResolvedValue(stockPurchaseRow());
});
afterEach(() => resetStockRoutes());

describe('PurchasesPage (clinic-stock.md:41–55)', () => {
  it('lists the bills the API answers with what is due on them in rupees, and the footer’s due', async () => {
    const { container } = renderStockRoutes(PURCHASES_URL, { purchases: PurchasesPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(listStockPurchases).toHaveBeenCalledWith(
      { q: undefined, status: undefined, vendor: undefined, created: undefined },
      undefined,
    );
    expect(rowOf('#16')).toHaveTextContent('Ankur Pharma');
    expect(rowOf('#16')).toHaveTextContent('₹2,392.50');
    expect(rowOf('#16')).toHaveTextContent('₹1,500');
    expect(rowOf('#15')).toHaveTextContent('₹1,710');
    expect(rowOf('#15')).toHaveTextContent('Unpaid');
    await waitFor(() =>
      expect(screen.getByTestId('stock-purchases-table-footer')).toHaveTextContent(
        '2 purchases · ₹3,210 due',
      ),
    );
    expect(screen.getByTestId('stock-purchases-table-end')).toHaveTextContent(
      'All purchases loaded',
    );
    // Paying a bill waits for Payments (Q-S3).
    expect(screen.queryByTestId('stock-purchases-row-action-pay')).toBeNull();
    expect(await screen.findByTestId('stock-purchases-new')).toHaveTextContent(
      'New purchase',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the statuses, one supplier and the API’s sorts from the URL — never a sort by supplier', async () => {
    renderStockRoutes(
      `${PURCHASES_URL}?status=unpaid&status=partial&vendor=${CRANIX_ID}&sort=due:desc`,
      { purchases: PurchasesPage },
    );
    await waitFor(() =>
      expect(listStockPurchases).toHaveBeenCalledWith(
        {
          q: undefined,
          status: ['unpaid', 'partial'],
          vendor: CRANIX_ID,
          created: undefined,
          sort: 'due',
          order: 'desc',
        },
        undefined,
      ),
    );
    expect(
      await screen.findByTestId('stock-purchases-filters-trigger'),
    ).toHaveTextContent('3');
  });

  it('filters by the three statuses and one supplier from the catalogue', async () => {
    const user = setup();
    const { router } = renderStockRoutes(PURCHASES_URL, { purchases: PurchasesPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(screen.getByTestId('stock-purchases-filters-trigger'));
    const panel = await screen.findByTestId('stock-purchases-filters');
    const statuses = within(panel).getByRole('group', {
      name: word(STOCK_KEYS.filters.status),
    });
    expect(within(statuses).getAllByRole('button')).toHaveLength(3);
    await user.click(within(statuses).getByRole('button', { name: 'Unpaid' }));
    await user.click(
      within(panel).getByRole('button', {
        name: word(STOCK_KEYS.purchases.vendorFilter.any),
      }),
    );
    await user.click(within(panel).getByRole('button', { name: /Cranix Pharma/ }));
    await user.click(within(panel).getByTestId('stock-purchases-filters-apply'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        status: ['unpaid'],
        vendor: CRANIX_ID,
      }),
    );
    await waitFor(() =>
      expect(listStockPurchases).toHaveBeenLastCalledWith(
        { q: undefined, status: ['unpaid'], vendor: CRANIX_ID, created: undefined },
        undefined,
      ),
    );
  });

  it('a row opens Edit purchase', async () => {
    const user = setup();
    const { router } = renderStockRoutes(PURCHASES_URL, { purchases: PurchasesPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(within(rowOf('#16')).getByText('Ankur Pharma'));
    await waitFor(
      () =>
        expect(router.state.location.pathname).toBe(
          `${PURCHASES_URL}/${TEST_STOCK_PURCHASE_ID}/edit`,
        ),
      { timeout: 3000 },
    );
    expect(await screen.findByTestId('stock-purchase-drawer-tag')).toHaveTextContent(
      '#16',
    );
  });

  it('Delete says why a bill with money paid stays; an unpaid one goes with a reason', async () => {
    const user = setup();
    renderStockRoutes(PURCHASES_URL, { purchases: PurchasesPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(
      within(rowOf('#16')).getByTestId('stock-purchases-row-action-delete'),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      i18n.t(STOCK_DRAWER_KEYS.confirm.blocked.purchasePaid, { ns: STOCK_NS }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await user.click(
      within(rowOf('#15')).getByTestId('stock-purchases-row-action-delete'),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this purchase?');
    expect(confirm).toHaveTextContent('Cranix Pharma');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteStockPurchase).toHaveBeenCalledWith({
        id: UNPAID_ID,
        reason: 'duplicate',
        note: null,
      }),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Purchase #15 deleted',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });

  it('a bill paid since it was read (409 purchase_paid) says why and reads the list again', async () => {
    const user = setup();
    vi.mocked(deleteStockPurchase).mockRejectedValueOnce(
      new HttpError('refused', 409, '/app/stock-purchases/x', 'DELETE', {
        error: { reason: 'purchase_paid', detail: 'Something is paid on this purchase' },
      }),
    );
    renderStockRoutes(PURCHASES_URL, { purchases: PurchasesPage });
    await waitFor(() => expect(rows()).toHaveLength(2));
    const reads = vi.mocked(listStockPurchases).mock.calls.length;
    await user.click(
      within(rowOf('#15')).getByTestId('stock-purchases-row-action-delete'),
    );
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        i18n.t(STOCK_DRAWER_KEYS.confirm.blocked.purchasePaid, { ns: STOCK_NS }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() =>
      expect(vi.mocked(listStockPurchases).mock.calls.length).toBeGreaterThan(reads),
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('a member who only reads (Accountant) gets no New purchase and no Delete', async () => {
    renderStockRoutes(
      PURCHASES_URL,
      { purchases: PurchasesPage },
      { role: 'accountant' },
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByTestId('stock-purchases-new')).toBeNull();
    expect(screen.queryByTestId('stock-purchases-row-action-delete')).toBeNull();
    expect(screen.getAllByTestId('stock-purchases-row-action-edit')).toHaveLength(2);
  });

  it('a first read that fails shows the error in place, with Retry', async () => {
    const user = setup();
    vi.mocked(listStockPurchases)
      .mockRejectedValueOnce(new Error('connection dropped'))
      .mockResolvedValue({
        rows: [stockPurchaseRow({ vendorId: TEST_STOCK_VENDOR_ID })],
        next: null,
        total: 1,
      });
    renderStockRoutes(PURCHASES_URL, { purchases: PurchasesPage });
    await user.click(await screen.findByTestId('retry-button'));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });
});
