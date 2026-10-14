import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicalSales: vi.fn(),
  fetchMedicalSale: vi.fn(),
  listSaleReminders: vi.fn(),
  listPrescriptionsToFill: vi.fn(),
  listPurchaseOrders: vi.fn(),
  fetchPurchaseOrder: vi.fn(),
  fetchOldestOpenPurchaseOrder: vi.fn(),
  listSuppliers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchSupplier: vi.fn(),
  fetchSupplierAccount: vi.fn(),
  listSupplierCredits: vi.fn(),
  listManufacturers: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchManufacturer: vi.fn(),
  listMedicalReps: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
  fetchMedicalRep: vi.fn(),
  fetchMrVisits: vi.fn(),
  medicalListSummary: vi.fn(),
}));
vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicines: vi.fn(),
  fetchAllMedicines: vi.fn(),
  fetchMedicine: vi.fn(),
}));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStoreLedger: vi.fn(),
  exportStoreLedger: vi.fn(),
}));
vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStoreCredits: vi.fn(),
  fetchStoreCreditCount: vi.fn(),
}));

import { listStoreCredits } from '@/shared/api/app/credits-api.ts';
import { listMedicines } from '@/shared/api/app/medicines-api.ts';
import { listStoreLedger } from '@/shared/api/app/payments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { medicalPage } from '@/tests/utils/medical-doubles.ts';

import { MedicalCreditsPage } from '../../credits/MedicalCreditsPage.tsx';
import { ManufacturersPage } from '../../manufacturers/ManufacturersPage.tsx';
import { MedicinesPage } from '../../medicines/MedicinesPage.tsx';
import { MrsPage } from '../../mrs/MrsPage.tsx';
import { MedicalPaymentsPage } from '../../payments/MedicalPaymentsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { SalesPage } from '../../sales/SalesPage.tsx';
import {
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPurchaseOrders,
  listSupplierCredits,
  listSuppliers,
} from '../../shared/medical-api.ts';
import { SuppliersPage } from '../../suppliers/SuppliersPage.tsx';
import {
  MEDICAL_ROOM_NOW,
  MEDICAL_ROOM_URL as ROOM,
  MEDICAL_ROW_COUNTS,
  primeMedicalRoom,
  SALE_ROWS,
} from './medical-room-test-data.ts';
import {
  MEDICAL_TEST_TABS,
  type MedicalTestTab,
  renderMedicalRoutes,
  resetMedicalRoutes,
} from './medical-test-router.tsx';

// The footers (their counts) show from `md`; a phone hides them.
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

const PAGES = {
  sales: SalesPage,
  medicines: MedicinesPage,
  purchases: PurchasesPage,
  suppliers: SuppliersPage,
  manufacturers: ManufacturersPage,
  mrs: MrsPage,
  payments: MedicalPaymentsPage,
  credits: MedicalCreditsPage,
};

/** The tab row's names, in its order. */
const TAB_NAMES = [
  'Sales',
  'Medicines',
  'Purchases',
  'Suppliers',
  'Manufacturers',
  'MRs',
  'Payments',
  'Credits',
];

const rows = (tab: MedicalTestTab) => screen.getAllByTestId(`medical-${tab}-table-row`);
const rowOf = (tab: MedicalTestTab, text: string) => {
  const row = rows(tab).find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};
const footer = (tab: MedicalTestTab) => screen.getByTestId(`medical-${tab}-table-footer`);

/** Open a tab at `query` and wait for the rows its read answers and every other read it makes. */
async function openTab(tab: MedicalTestTab, query = '') {
  const view = renderMedicalRoutes(`${ROOM}/${tab}${query}`, PAGES);
  await waitFor(() => expect(rows(tab)).toHaveLength(MEDICAL_ROW_COUNTS[tab]));
  await waitFor(() => expect(view.queryClient.isFetching()).toBe(0));
  return view;
}

/** A 503 as clinozy-be answers a read it cannot serve. */
const unavailable = (path: string) => new HttpError('down', 503, path, 'GET', {});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MEDICAL_ROOM_NOW);
  vi.resetAllMocks();
  primeMedicalRoom();
});
afterEach(() => {
  // Unmount before the stores reset, so no tree re-renders outside `act`.
  cleanup();
  vi.useRealTimers();
  resetMedicalRoutes();
});

describe('Medical on clinozy-be — each tab’s rows from its read', () => {
  it('Sales: each sale with its customer, bill and status, the footer’s count and the end line', async () => {
    const { container } = await openTab('sales');
    expect(listMedicalSales).toHaveBeenCalledWith({}, undefined);
    expect(screen.getByRole('heading', { level: 1, name: 'Medical' })).toBeVisible();
    const unpaid = rowOf('sales', 'Priya Shah');
    expect(unpaid).toHaveTextContent('#978');
    expect(unpaid).toHaveTextContent('Azelaic gel 15g ×2');
    expect(unpaid).toHaveTextContent('₹1,300');
    expect(unpaid).toHaveTextContent('Unpaid');
    expect(rowOf('sales', 'Rhea Shah')).toHaveTextContent('Paid');
    expect(rowOf('sales', 'Meera Joshi')).toHaveTextContent('Medical contact');
    await waitFor(() => expect(footer('sales')).toHaveTextContent('3 sales'));
    expect(screen.getByTestId('medical-sales-table-end')).toHaveTextContent(
      'All sales loaded',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Sales: the Status filter rides the URL into the read', async () => {
    await openTab('sales', '?status=unpaid');
    expect(listMedicalSales).toHaveBeenCalledWith({ status: 'unpaid' }, undefined);
  });

  it('Medicines: the server’s stock level, nearest expiry and margin; the URL’s search and Stock in the read', async () => {
    await openTab('medicines', '?q=gly&stock=low');
    expect(listMedicines).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'gly', stock: 'low' }),
      undefined,
    );
    const azelaic = rowOf('medicines', 'Azelaic gel 15g');
    expect(azelaic).toHaveTextContent('₹650');
    expect(azelaic).toHaveTextContent('12 in stock · OK');
    expect(azelaic).toHaveTextContent('12/27 · 026-312');
    expect(azelaic).toHaveTextContent('35%');
    expect(rowOf('medicines', 'Glycolac Cream')).toHaveTextContent('3 in stock · Low');
    const empty = rowOf('medicines', 'Trichospire Hair Kit');
    expect(empty).toHaveTextContent('0 in stock · Out');
    expect(empty).toHaveTextContent('No stock');
    // Medicines leaves the footer's count blank (`medical.md:19`).
    expect(footer('medicines')).not.toHaveTextContent(/medicines/);
    expect(screen.getByPlaceholderText(/Search/)).toHaveValue('gly');
  });

  it('Purchases: each order’s supplier, medicines, total and stage in rupees, the footer’s count', async () => {
    await openTab('purchases', '?stage=received');
    expect(listPurchaseOrders).toHaveBeenCalledWith({ stage: 'received' }, undefined);
    const received = rowOf('purchases', '#431');
    expect(received).toHaveTextContent('Ankur Pharma');
    expect(received).toHaveTextContent('Azelaic gel 15g');
    expect(received).toHaveTextContent('₹4,236');
    expect(received).toHaveTextContent('₹3,409 paid');
    expect(rowOf('purchases', '#430')).toHaveTextContent('Ordered');
    expect(rowOf('purchases', '#428')).toHaveTextContent('₹1,296');
    await waitFor(() => expect(footer('purchases')).toHaveTextContent('3 orders'));
  });

  it('Suppliers: the server’s orders, payable and ageing, the footer’s payable', async () => {
    await openTab('suppliers');
    expect(listSuppliers).toHaveBeenCalledWith({}, undefined);
    const owed = within(rowOf('suppliers', 'Ankur Pharma'));
    expect(owed.getByText('2 orders')).toBeInTheDocument();
    expect(owed.getByText('₹827')).toBeInTheDocument();
    expect(owed.getByText('5 days')).toBeInTheDocument();
    expect(owed.getByText('SUN PHARMA')).toBeInTheDocument();
    expect(within(rowOf('suppliers', 'NH Pharma')).getByText('1 order')).toBeVisible();
    expect(
      within(rowOf('suppliers', 'Akshar Medicines')).getByText('Add phone'),
    ).toBeVisible();
    await waitFor(() =>
      expect(footer('suppliers')).toHaveTextContent('3 suppliers · ₹827 payable'),
    );
  });

  it('Manufacturers: each maker’s medicines, suppliers and MRs, the footer’s count', async () => {
    await openTab('manufacturers');
    expect(listManufacturers).toHaveBeenCalledWith({}, undefined);
    const sun = within(rowOf('manufacturers', 'SUN PHARMA'));
    expect(sun.getByText('14 medicines')).toBeInTheDocument();
    expect(sun.getByText('Ankur Pharma')).toBeInTheDocument();
    expect(sun.getByText('Rahul Mehta')).toBeInTheDocument();
    expect(within(rowOf('manufacturers', 'ZEN')).getByText('None yet')).toBeVisible();
    await waitFor(() =>
      expect(footer('manufacturers')).toHaveTextContent('2 manufacturers'),
    );
  });

  it('MRs: the makers each represents, the footer’s count', async () => {
    await openTab('mrs');
    expect(listMedicalReps).toHaveBeenCalledWith({}, undefined);
    expect(within(rowOf('mrs', 'Rahul Mehta')).getByText('SUN PHARMA')).toBeVisible();
    expect(within(rowOf('mrs', 'Rakesh')).getByText('Add phone')).toBeVisible();
    await waitFor(() => expect(footer('mrs')).toHaveTextContent('2 MRs'));
  });

  it('Payments: the store’s slice of the ledger with the URL’s filters, under "New sale"', async () => {
    await openTab('payments', '?kind=expense&q=Ankur');
    expect(vi.mocked(listStoreLedger).mock.calls[0]?.[0]).toMatchObject({
      kind: ['expense'],
      q: 'Ankur',
    });
    expect(rowOf('payments', 'Priya Shah')).toHaveTextContent('PAY-5');
    expect(rowOf('payments', 'PAY-6')).toHaveTextContent('Ankur Pharma');
    expect(screen.getByTestId('medical-payments-new')).toHaveTextContent('New sale');
    expect(screen.getByTestId('medical-payments-table-end')).toHaveTextContent(
      'All Medical payments loaded',
    );
  });

  it('Credits: the suppliers’ credits, then the customers’ on the other side — the URL saying which', async () => {
    const user = setup();
    const { router } = await openTab('credits');
    expect(listSupplierCredits).toHaveBeenCalledWith({}, undefined);
    expect(rowOf('credits', '026-312')).toHaveTextContent('Ankur Pharma');
    expect(rowOf('credits', '026-312')).toHaveTextContent('Open');
    expect(rowOf('credits', '026-298')).toHaveTextContent('Adjusted');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    await waitFor(() => expect(footer('credits')).toHaveTextContent('2 credits'));

    await user.click(screen.getByTestId('medical-credits-side-customers'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ side: 'customers' }),
    );
    expect(router.state.location.pathname).toBe(`${ROOM}/credits`);
    await waitFor(() => expect(rows('credits')).toHaveLength(1));
    expect(rowOf('credits', 'Priya Shah')).toBeInTheDocument();
    expect(listStoreCredits).toHaveBeenCalled();
    await waitFor(() => expect(footer('credits')).toHaveTextContent('1 credit'));
  });
});

describe('the Medical tab row', () => {
  it('shows the eight tabs as links into the room, the current one marked', async () => {
    await openTab('suppliers');
    const nav = screen.getByRole('navigation', { name: 'Medical sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(TAB_NAMES);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      MEDICAL_TEST_TABS.map((tab) => `${ROOM}/${tab}`),
    );
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-suppliers-tab-suppliers',
    );
  });

  it('moves through every tab — the URL following, each tab reading its own list', async () => {
    const user = setup();
    const { router } = await openTab('sales');
    const order = [...MEDICAL_TEST_TABS.slice(1), 'sales' as const];
    let from: MedicalTestTab = 'sales';
    for (const to of order) {
      await user.click(screen.getByTestId(`medical-${from}-tab-${to}`));
      await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/${to}`));
      await waitFor(() => expect(rows(to)).toHaveLength(MEDICAL_ROW_COUNTS[to]));
      expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
        'data-testid',
        `medical-${to}-tab-${to}`,
      );
      from = to;
    }
  });

  it('keeps each tab’s filters in its own URL: a tab starts clean, Back brings the filter and its read back', async () => {
    const user = setup();
    const { router } = await openTab('sales', '?status=unpaid');
    await user.click(screen.getByTestId('medical-sales-tab-medicines'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/medicines`));
    expect(router.state.location.search).toEqual({});
    await waitFor(() => expect(rows('medicines')).toHaveLength(3));

    vi.mocked(listMedicalSales).mockClear();
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/sales`));
    expect(router.state.location.search).toMatchObject({ status: 'unpaid' });
    await waitFor(() => expect(rows('sales')).toHaveLength(3));
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-sales-tab-sales',
    );
  });
});

describe('a Medical tab with nothing to show, or a read that fails', () => {
  it('an empty read shows the tab’s empty state with no button; the toolbar’s "New medicine" adds', async () => {
    const user = setup();
    vi.mocked(listMedicines).mockResolvedValue(medicalPage([]));
    const { router } = renderMedicalRoutes(`${ROOM}/medicines`, PAGES);
    const empty = await screen.findByTestId('empty-state');
    expect(empty).toHaveTextContent('No medicine matches');
    expect(screen.queryByTestId('medical-medicines-table-row')).not.toBeInTheDocument();
    // fix-empty-state-actions: the toolbar is the one way to add.
    expect(within(empty).queryByTestId('empty-state-action')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('medical-medicines-new'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/medicines/create`),
    );
    expect(await screen.findByTestId('medicine-drawer')).toBeInTheDocument();
  });

  it('a filtered read with no match offers "Clear filters", which reads the whole list', async () => {
    const user = setup();
    vi.mocked(listMedicalSales).mockImplementation(async (params) =>
      medicalPage(params.status ? [] : SALE_ROWS),
    );
    const { router } = renderMedicalRoutes(`${ROOM}/sales?status=returned`, PAGES);
    await user.click(await screen.findByTestId('empty-state-clear-filters'));
    await waitFor(() =>
      expect(router.state.location.search).not.toHaveProperty('status'),
    );
    await waitFor(() => expect(rows('sales')).toHaveLength(3));
  });

  it('a first read that fails shows Retry in place; Retry reads the list again', async () => {
    const user = setup();
    vi.mocked(listSuppliers).mockRejectedValueOnce(unavailable('/app/suppliers'));
    renderMedicalRoutes(`${ROOM}/suppliers`, PAGES);
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() => expect(rows('suppliers')).toHaveLength(3));
    expect(screen.queryByTestId('retry-error')).not.toBeInTheDocument();
  });

  it('a failed read toasts "Couldn’t load this list" with Retry, which reads it again', async () => {
    vi.mocked(listPurchaseOrders).mockRejectedValueOnce(
      unavailable('/app/medical-purchase-orders'),
    );
    renderMedicalRoutes(`${ROOM}/purchases`, PAGES);
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({
          id: 'list-error:medical-purchases',
          action: expect.objectContaining({ label: 'Retry' }),
        }),
      ),
    );
    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    await waitFor(() => expect(rows('purchases')).toHaveLength(3));
    expect(listPurchaseOrders).toHaveBeenCalledTimes(2);
  });
});
