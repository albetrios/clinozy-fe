import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOldestOpenStockPurchase: vi.fn(),
  listStockVendors: vi.fn(),
  fetchStockVendor: vi.fn(),
  stockListSummary: vi.fn(),
}));
vi.mock('../shared/stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteStockVendor: vi.fn(),
  restoreStockVendor: vi.fn(),
}));
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { stockPurchaseRow, stockVendorRow } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockRoutes,
  resetStockRoutes,
} from '../__tests__/integration/stock-test-router.tsx';
import { useStockDeleteBlockText } from '../shared/components/StockDeleteConfirm/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import {
  fetchOldestOpenStockPurchase,
  fetchStockVendor,
  listStockVendors,
  stockListSummary,
} from '../shared/stock-api.ts';
import type { StockVendorRow } from '../shared/stock-contracts.ts';
import { deleteStockVendor } from '../shared/stock-records-api.ts';
import { VendorsPage } from './VendorsPage.tsx';

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

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const VENDORS_URL = '/organization/acme/stock/vendors';
// Public ids as the URL takes them (`<prefix>_<21 [a-z0-9]>`).
const ANKUR_ID = 'svnd_ankurpharma000000000';
const IBREIA_ID = 'svnd_ibreia000000000000000';
const QUICK_ID = 'svnd_quickvendor000000000';
const OLDEST_BILL_ID = 'spur_ankuroldest000000000a';

/** Ankur Pharma, owed ₹1,500 over two purchases; Ibreia, owed nothing; a quick vendor with no phone. */
const ROWS: StockVendorRow[] = [
  stockVendorRow({ id: ANKUR_ID }),
  stockVendorRow({
    id: IBREIA_ID,
    name: 'Ibreia',
    phone: '+918238450007',
    payable: 0,
    purchaseCount: 1,
  }),
  stockVendorRow({
    id: QUICK_ID,
    name: 'Ankit Traders',
    phone: null,
    isQuick: true,
    payable: 0,
    purchaseCount: 0,
  }),
];

/** The tab, with a mark once the member's access is known — the gates' answers are final then. */
function VendorsTab() {
  const { resolved } = useStockAccess();
  return (
    <>
      {resolved ? <span data-testid="access-resolved" hidden /> : null}
      <VendorsPage />
    </>
  );
}

/** The Vendors tab at `url` for `role`, once its rows are listed and the access is known. */
async function openVendors(url = VENDORS_URL, role: Role = 'admin') {
  const view = renderStockRoutes(url, { vendors: VendorsTab }, { role });
  await waitFor(() =>
    expect(screen.getAllByTestId('stock-vendors-table-row')).toHaveLength(ROWS.length),
  );
  await screen.findByTestId('access-resolved');
  return view;
}

/** One row of the table, by its vendor's name. */
function rowNamed(name: string) {
  const row = screen
    .getAllByTestId('stock-vendors-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
}

/** A 409 as clinozy-be sends it, with its reason. */
const conflict = (reason: string, detail: string) =>
  new HttpError(detail, 409, '/app/stock-vendors', 'DELETE', {
    error: { type: 'request_error', code: 'conflict', reason, detail },
  });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listStockVendors).mockResolvedValue({ rows: ROWS, next: null, total: 3 });
  vi.mocked(stockListSummary).mockResolvedValue({ total: 3, due: 1500 });
  vi.mocked(fetchStockVendor).mockResolvedValue(stockVendorRow({ id: ANKUR_ID }));
});
afterEach(() => resetStockRoutes());

describe('VendorsPage (Q-K1)', () => {
  it('lists the vendors with the server’s purchases and payable, the count and the end line', async () => {
    const { container } = await openVendors();
    expect(listStockVendors).toHaveBeenCalledWith({}, undefined);
    expect(stockListSummary).toHaveBeenCalledWith('vendors', {});
    expect(rowNamed('Ankur Pharma').getByText('2 purchases')).toBeInTheDocument();
    expect(rowNamed('Ankur Pharma').getByText('₹1,500')).toBeInTheDocument();
    expect(rowNamed('Ankur Pharma').getByText('+91 98765 00011')).toBeInTheDocument();
    expect(rowNamed('Ibreia').getByText('1 purchase')).toBeInTheDocument();
    expect(rowNamed('Ankit Traders').getByText('No purchases')).toBeInTheDocument();
    expect(rowNamed('Ankit Traders').getByText('Add phone')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('stock-vendors-table-footer')).toHaveTextContent(
        '3 vendors · ₹1,500 payable',
      ),
    );
    expect(screen.getByTestId('stock-vendors-table-end')).toHaveTextContent(
      'All vendors loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('searches by name and sorts by Payable through the API — the footer follows the search', async () => {
    const user = setup();
    vi.mocked(stockListSummary).mockResolvedValue({ total: 1, due: 1500 });
    const { router } = await openVendors(`${VENDORS_URL}?q=ankur`);
    expect(listStockVendors).toHaveBeenCalledWith({ q: 'ankur' }, undefined);
    expect(stockListSummary).toHaveBeenCalledWith('vendors', { q: 'ankur' });
    await waitFor(() =>
      expect(screen.getByTestId('stock-vendors-table-footer')).toHaveTextContent(
        '1 vendor · ₹1,500 payable',
      ),
    );

    const payable = screen
      .getAllByRole('columnheader')
      .find((header) => header.textContent?.includes('Payable'));
    await user.click(within(payable as HTMLElement).getByRole('button'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'payable:asc' }),
    );
    await waitFor(() =>
      expect(listStockVendors).toHaveBeenLastCalledWith(
        { q: 'ankur', sort: 'payable', order: 'asc' },
        undefined,
      ),
    );
    // A sort changes neither figure: the footer keeps its one read.
    expect(stockListSummary).toHaveBeenCalledTimes(1);
  });

  it('"Pay ₹X" reads the vendor’s oldest open bill once, on the click, and opens Send payment on it (Q-S3)', async () => {
    const user = setup();
    vi.mocked(fetchOldestOpenStockPurchase).mockResolvedValue(
      stockPurchaseRow({ id: OLDEST_BILL_ID }),
    );
    const { router } = await openVendors();
    const pay = rowNamed('Ankur Pharma').getByTestId('stock-vendors-row-action-pay');
    expect(pay).toHaveAccessibleName('Pay ₹1,500');
    // Owed nothing: no Pay. And no read per row before a click.
    expect(rowNamed('Ibreia').queryByTestId('stock-vendors-row-action-pay')).toBeNull();
    expect(fetchOldestOpenStockPurchase).not.toHaveBeenCalled();

    await user.click(pay);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
    expect(router.state.location.search).toEqual({ bill: OLDEST_BILL_ID });
    expect(fetchOldestOpenStockPurchase).toHaveBeenCalledTimes(1);
    expect(fetchOldestOpenStockPurchase).toHaveBeenCalledWith(ANKUR_ID);
  });

  it('"Pay ₹X" on a vendor paid up meanwhile says so and reads the vendors again; a failed read says why', async () => {
    const user = setup();
    vi.mocked(fetchOldestOpenStockPurchase).mockResolvedValueOnce(null);
    const { router } = await openVendors();
    const reads = vi.mocked(listStockVendors).mock.calls.length;

    await user.click(
      rowNamed('Ankur Pharma').getByTestId('stock-vendors-row-action-pay'),
    );
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith('Nothing is owed to Ankur Pharma now'),
    );
    await waitFor(() =>
      expect(vi.mocked(listStockVendors).mock.calls.length).toBeGreaterThan(reads),
    );
    expect(router.state.location.pathname).toBe(VENDORS_URL);

    vi.mocked(fetchOldestOpenStockPurchase).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/stock-purchases', 'GET', {}),
    );
    await user.click(
      rowNamed('Ankur Pharma').getByTestId('stock-vendors-row-action-pay'),
    );
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe(VENDORS_URL);
  });

  it('"Pay ₹X" needs payment:create and payment:read — create alone (PAY-M3) shows none', async () => {
    renderStockRoutes(
      VENDORS_URL,
      { vendors: VendorsTab },
      {
        permissions: [
          'organization:read',
          'stock_item:read',
          'stock_item:create',
          'payment:create',
        ],
      },
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-vendors-table-row')).toHaveLength(ROWS.length),
    );
    await screen.findByTestId('access-resolved');
    expect(
      rowNamed('Ankur Pharma').getByTestId('stock-vendors-row-action-edit'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('stock-vendors-row-action-pay')).not.toBeInTheDocument();
  });

  it('opens Edit clinic vendor from a row, read through the vendor’s own route', async () => {
    const user = setup();
    const { router } = await openVendors();
    await user.click(rowNamed('Ankur Pharma').getByText('Ankur Pharma'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${VENDORS_URL}/${ANKUR_ID}/edit`),
    );
    const drawer = await screen.findByTestId('stock-vendor-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('stock-vendor-drawer-name')).toHaveValue(
        'Ankur Pharma',
      ),
    );
    expect(fetchStockVendor).toHaveBeenCalledWith(ANKUR_ID);
  });

  it('Delete only while nothing is owed; asks for a reason and removes the vendor', async () => {
    const user = setup();
    vi.mocked(deleteStockVendor).mockResolvedValue(undefined);
    await openVendors();
    expect(
      rowNamed('Ankur Pharma').queryByTestId('stock-vendors-row-action-delete'),
    ).not.toBeInTheDocument();

    await user.click(rowNamed('Ibreia').getByTestId('stock-vendors-row-action-delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this clinic vendor?');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteStockVendor).toHaveBeenCalledWith({
        id: IBREIA_ID,
        reason: 'duplicate',
        note: null,
      }),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Ibreia removed', expect.anything());
  });

  it('a delete refused for dues says why, closes and reads the vendors again', async () => {
    const user = setup();
    const blockText = renderHook(() => useStockDeleteBlockText()).result.current;
    vi.mocked(deleteStockVendor).mockRejectedValue(
      conflict(
        'vendor_has_dues',
        'A purchase from this vendor is not fully paid — pay or settle it first',
      ),
    );
    await openVendors();
    const reads = vi.mocked(listStockVendors).mock.calls.length;

    await user.click(rowNamed('Ibreia').getByTestId('stock-vendors-row-action-delete'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(blockText('vendor_has_dues')),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(vi.mocked(listStockVendors).mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it('a Pharmacist (create, update) adds and edits but deletes nothing', async () => {
    vi.mocked(listStockVendors).mockResolvedValue({ rows: ROWS, next: null, total: 3 });
    await openVendors(undefined, 'pharmacist');
    expect(
      rowNamed('Ibreia').getByTestId('stock-vendors-row-action-edit'),
    ).toBeInTheDocument();
    expect(
      rowNamed('Ibreia').queryByTestId('stock-vendors-row-action-delete'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('stock-vendors-new')).toBeInTheDocument();
  });

  it('an Accountant (view) gets no "+ New clinic vendor", not even on the empty state', async () => {
    vi.mocked(listStockVendors).mockResolvedValue({ rows: [], next: null, total: 0 });
    vi.mocked(stockListSummary).mockResolvedValue({ total: 0, due: 0 });
    renderStockRoutes(
      `${VENDORS_URL}?q=nobody`,
      { vendors: VendorsTab },
      { role: 'accountant' },
    );
    expect(await screen.findByText('No vendor matches')).toBeVisible();
    await screen.findByTestId('access-resolved');
    expect(
      within(screen.getByTestId('empty-state')).queryByRole('button'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-vendors-new')).not.toBeInTheDocument();
  });

  it('an Admin’s empty search offers "New clinic vendor"', async () => {
    vi.mocked(listStockVendors).mockResolvedValue({ rows: [], next: null, total: 0 });
    renderStockRoutes(`${VENDORS_URL}?q=nobody`, { vendors: VendorsTab });
    expect(await screen.findByText('No vendor matches')).toBeVisible();
    expect(
      await within(screen.getByTestId('empty-state')).findByRole('button', {
        name: 'New clinic vendor',
      }),
    ).toBeVisible();
  });

  it('shows a first read that fails in place, with Retry', async () => {
    const user = setup();
    vi.mocked(listStockVendors).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/stock-vendors', 'GET', {}),
    );
    renderStockRoutes(VENDORS_URL, { vendors: VendorsTab });
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('stock-vendors-table-row')).toHaveLength(ROWS.length),
    );
  });
});
