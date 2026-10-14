import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listSuppliers: vi.fn(),
  fetchSupplier: vi.fn(),
  fetchSupplierAccount: vi.fn(),
  fetchOldestOpenPurchaseOrder: vi.fn(),
  medicalListSummary: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteSupplier: vi.fn(),
  restoreSupplier: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  medicalPage,
  purchaseOrderRow,
  supplierRow,
  TEST_MAKER_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchOldestOpenPurchaseOrder,
  fetchSupplier,
  fetchSupplierAccount,
  listSuppliers,
  medicalListSummary,
} from '../shared/medical-api.ts';
import type { SupplierRow } from '../shared/medical-contracts.ts';
import { deleteSupplier } from '../shared/medical-records-api.ts';
import { SuppliersPage } from './SuppliersPage.tsx';

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

const SUPPLIERS_URL = '/organization/acme/medical/suppliers';
const NH_ID = 'sup_nhpharma00000000000000';
const QUICK_ID = 'sup_quickagency0000000000';
const OLDEST_ORDER_ID = 'mpo_ankuroldest0000000000';

/** Ankur Pharma, owed ₹827 for 5 days; NH Pharma, owed nothing; a quick supplier with no phone or orders. */
const ROWS: SupplierRow[] = [
  supplierRow(),
  supplierRow({
    id: NH_ID,
    name: 'NH Pharma',
    phone: '+918238450007',
    payable: 0,
    ageingDays: null,
    orderCount: 1,
    orderTotal: 1200,
  }),
  supplierRow({
    id: QUICK_ID,
    name: 'Shree Agency',
    phone: null,
    isQuick: true,
    manufacturers: [],
    manufacturerIds: [],
    payable: 0,
    ageingDays: null,
    orderCount: 0,
    orderTotal: 0,
  }),
];

/** The Suppliers tab at `url` for `role`, once its rows are listed. */
async function openSuppliers(
  url = SUPPLIERS_URL,
  role: Parameters<typeof renderMedicalRoutes>[2] = {},
) {
  const view = renderMedicalRoutes(url, { suppliers: SuppliersPage }, role);
  await waitFor(() =>
    expect(screen.getAllByTestId('medical-suppliers-table-row')).toHaveLength(
      ROWS.length,
    ),
  );
  return view;
}

/** One row of the table, by its supplier's name. */
function rowNamed(name: string) {
  const row = screen
    .getAllByTestId('medical-suppliers-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
}

/** A 409 as clinozy-be sends it, with its reason. */
const conflict = (reason: string, detail: string) =>
  new HttpError(detail, 409, '/app/suppliers', 'DELETE', {
    error: { type: 'request_error', code: 'conflict', reason, detail },
  });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(listSuppliers).mockResolvedValue(medicalPage(ROWS));
  vi.mocked(medicalListSummary).mockResolvedValue({ total: 3, payable: 827 });
  vi.mocked(fetchSupplier).mockResolvedValue(supplierRow());
  vi.mocked(fetchSupplierAccount).mockResolvedValue([]);
  vi.mocked(fetchAllManufacturers).mockResolvedValue([]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('SuppliersPage (medical.md:73–87)', () => {
  it('lists the suppliers with the server’s orders, payable and ageing, the footer and the end line', async () => {
    const { container } = await openSuppliers();
    expect(listSuppliers).toHaveBeenCalledWith({}, undefined);
    expect(medicalListSummary).toHaveBeenCalledWith('suppliers', {});
    expect(rowNamed('Ankur Pharma').getByText('2 orders')).toBeInTheDocument();
    expect(rowNamed('Ankur Pharma').getByText('₹827')).toBeInTheDocument();
    expect(rowNamed('Ankur Pharma').getByText('5 days')).toBeInTheDocument();
    expect(rowNamed('Ankur Pharma').getByText('SUN PHARMA')).toBeInTheDocument();
    expect(rowNamed('NH Pharma').getByText('1 order')).toBeInTheDocument();
    expect(rowNamed('Shree Agency').getByText('No orders')).toBeInTheDocument();
    expect(rowNamed('Shree Agency').getByText('Add phone')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('medical-suppliers-table-footer')).toHaveTextContent(
        '3 suppliers · ₹827 payable',
      ),
    );
    expect(screen.getByTestId('medical-suppliers-table-end')).toHaveTextContent(
      'All suppliers loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-suppliers-tab-suppliers',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads one manufacturer and "owed something" from the URL; a sort keeps the footer’s one read', async () => {
    const user = setup();
    const { router } = await openSuppliers(
      `${SUPPLIERS_URL}?manufacturer=${TEST_MAKER_ID}&payable=owed`,
    );
    const filters = { manufacturer: TEST_MAKER_ID, hasPayable: true };
    expect(listSuppliers).toHaveBeenCalledWith(filters, undefined);
    expect(medicalListSummary).toHaveBeenCalledWith('suppliers', filters);

    const payable = screen
      .getAllByRole('columnheader')
      .find((header) => header.textContent?.includes('Payable'));
    await user.click(within(payable as HTMLElement).getByRole('button'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'payable:asc' }),
    );
    await waitFor(() =>
      expect(listSuppliers).toHaveBeenLastCalledWith(
        { ...filters, sort: 'payable', order: 'asc' },
        undefined,
      ),
    );
    expect(medicalListSummary).toHaveBeenCalledTimes(1);
  });

  it('"Pay ₹X" reads the supplier’s oldest open order once, on the click, and opens Send payment on it', async () => {
    const user = setup();
    vi.mocked(fetchOldestOpenPurchaseOrder).mockResolvedValue(
      purchaseOrderRow({ id: OLDEST_ORDER_ID }),
    );
    const { router } = await openSuppliers();
    const pay = rowNamed('Ankur Pharma').getByTestId('medical-suppliers-row-action-pay');
    expect(pay).toHaveAccessibleName('Pay ₹827');
    // Owed nothing: no Pay. And no read per row before a click.
    expect(
      rowNamed('NH Pharma').queryByTestId('medical-suppliers-row-action-pay'),
    ).toBeNull();
    expect(fetchOldestOpenPurchaseOrder).not.toHaveBeenCalled();

    await user.click(pay);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
    expect(router.state.location.search).toEqual({ bill: OLDEST_ORDER_ID });
    expect(fetchOldestOpenPurchaseOrder).toHaveBeenCalledTimes(1);
    expect(fetchOldestOpenPurchaseOrder).toHaveBeenCalledWith(TEST_SUPPLIER_ID);
  });

  it('"Pay ₹X" on a supplier paid up meanwhile says so and reads the suppliers again; a failed read says why', async () => {
    const user = setup();
    vi.mocked(fetchOldestOpenPurchaseOrder).mockResolvedValueOnce(null);
    const { router } = await openSuppliers();
    const reads = vi.mocked(listSuppliers).mock.calls.length;

    await user.click(
      rowNamed('Ankur Pharma').getByTestId('medical-suppliers-row-action-pay'),
    );
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith('Nothing is owed to Ankur Pharma now'),
    );
    await waitFor(() =>
      expect(vi.mocked(listSuppliers).mock.calls.length).toBeGreaterThan(reads),
    );
    expect(router.state.location.pathname).toBe(SUPPLIERS_URL);

    vi.mocked(fetchOldestOpenPurchaseOrder).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/medical-purchase-orders', 'GET', {}),
    );
    await user.click(
      rowNamed('Ankur Pharma').getByTestId('medical-suppliers-row-action-pay'),
    );
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe(SUPPLIERS_URL);
  });

  it('the Supplier drawer offers "⚡ Pay ₹827" too, on the same one read', async () => {
    const user = setup();
    vi.mocked(fetchOldestOpenPurchaseOrder).mockResolvedValue(
      purchaseOrderRow({ id: OLDEST_ORDER_ID }),
    );
    const { router } = renderMedicalRoutes(`${SUPPLIERS_URL}/${TEST_SUPPLIER_ID}/edit`, {
      suppliers: SuppliersPage,
    });
    const pay = await screen.findByTestId('supplier-drawer-quick-fill-pay');
    expect(pay).toHaveTextContent('Pay ₹827');
    expect(fetchSupplier).toHaveBeenCalledWith(TEST_SUPPLIER_ID);
    await user.click(pay);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
    expect(router.state.location.search).toEqual({ bill: OLDEST_ORDER_ID });
  });

  it('"New purchase order" opens one on that supplier', async () => {
    const user = setup();
    const { router } = await openSuppliers();
    await user.click(
      rowNamed('NH Pharma').getByTestId('medical-suppliers-row-action-new-order'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/medical/purchases/create',
      ),
    );
  });

  it('Delete only while nothing is owed; asks for a reason and removes the supplier', async () => {
    const user = setup();
    vi.mocked(deleteSupplier).mockResolvedValue(undefined);
    await openSuppliers();
    expect(
      rowNamed('Ankur Pharma').queryByTestId('medical-suppliers-row-action-delete'),
    ).not.toBeInTheDocument();

    await user.click(
      rowNamed('NH Pharma').getByTestId('medical-suppliers-row-action-delete'),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this supplier?');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteSupplier).toHaveBeenCalledWith(NH_ID, 'mistake', null),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('NH Pharma deleted', expect.anything());
  });

  it('a delete refused for dues says why; closing the confirm reads the suppliers again', async () => {
    const user = setup();
    vi.mocked(deleteSupplier).mockRejectedValue(
      conflict(
        'supplier_has_dues',
        'This supplier has an open credit or an order to receive',
      ),
    );
    await openSuppliers();
    const reads = vi.mocked(listSuppliers).mock.calls.length;

    await user.click(
      rowNamed('NH Pharma').getByTestId('medical-suppliers-row-action-delete'),
    );
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(notifyMock.undo).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(vi.mocked(listSuppliers).mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it('a Doctor (view, payments read only) gets Edit alone — no Pay, no new order, no Delete', async () => {
    await openSuppliers(SUPPLIERS_URL, { role: 'doctor' });
    await waitFor(() =>
      expect(
        rowNamed('NH Pharma').getByTestId('medical-suppliers-row-action-edit'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId('medical-suppliers-row-action-pay'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-suppliers-row-action-new-order'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('medical-suppliers-row-action-delete'),
    ).not.toBeInTheDocument();
  });

  it('shows a first read that fails in place, with Retry', async () => {
    const user = setup();
    vi.mocked(listSuppliers).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/suppliers', 'GET', {}),
    );
    renderMedicalRoutes(SUPPLIERS_URL, { suppliers: SuppliersPage });
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-suppliers-table-row')).toHaveLength(
        ROWS.length,
      ),
    );
  });
});
