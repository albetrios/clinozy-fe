import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPurchaseOrders: vi.fn(),
  medicalListSummary: vi.fn(),
  fetchPurchaseOrder: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMedicines: vi.fn(),
}));
import { fetchAllMedicines } from '@/shared/api/app/medicines-api.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  medicalPage,
  medicineRow,
  purchaseOrderRow,
  supplierRow,
  TEST_PURCHASE_ORDER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import type { MedicalSummaryTab } from '../shared/medical-api.ts';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchPurchaseOrder,
  listPurchaseOrders,
  medicalListSummary,
} from '../shared/medical-api.ts';
import { PurchasesPage } from './PurchasesPage.tsx';

// The footer (its count) shows from `md`; a phone hides it.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

const ROOM = '/organization/acme/medical/purchases';
const PAY = '/organization/acme/payments/pay';
const SUPPLIERS = '/organization/acme/medical/suppliers';
const ORDERED_ID = 'mpo_order4300000000000000';
const PAID_ID = 'mpo_order4280000000000000';
const KR_ID = 'sup_krmedical000000000000';
const AKSHAR_ID = 'sup_akshar000000000000000';

/** #431 received from Ankur Pharma, ₹827 due; #430 Ordered from K R; #428 paid to Akshar. */
const RECEIVED = purchaseOrderRow();
const ORDERED = purchaseOrderRow({
  id: ORDERED_ID,
  seq: 430,
  stage: 'ordered',
  apiStage: 'ordered',
  receivedAt: null,
  supplier: { id: KR_ID, name: 'K R Medical Agency', phone: null, gstNumber: null },
  supplierBillNo: null,
  paid: 0,
  due: 0,
  paymentStatus: 'unpaid',
});
const PAID = purchaseOrderRow({
  id: PAID_ID,
  seq: 428,
  stage: 'paid',
  supplier: { id: AKSHAR_ID, name: 'Akshar Medicines', phone: null, gstNumber: null },
  total: 1296,
  paid: 1296,
  due: 0,
  paymentStatus: 'paid',
});
const ORDERS = [RECEIVED, ORDERED, PAID];

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The Purchases tab at `url`. */
function renderPurchases(url = ROOM, role?: 'pharmacist' | 'accountant') {
  return renderMedicalRoutes(url, { purchases: PurchasesPage }, role ? { role } : {});
}

const rows = () => screen.getAllByTestId('medical-purchases-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row with ${text}`);
  return row;
};

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  vi.mocked(listPurchaseOrders).mockResolvedValue(medicalPage(ORDERS));
  vi.mocked(medicalListSummary).mockImplementation(async (tab: MedicalSummaryTab) =>
    tab === 'suppliers' ? { total: 2, payable: 2980 } : { total: 3, payable: 0 },
  );
  vi.mocked(fetchPurchaseOrder).mockImplementation(
    async (id) => ORDERS.find((order) => order.id === id) ?? RECEIVED,
  );
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow({ id: AKSHAR_ID, name: 'Akshar Medicines' }),
    supplierRow({ id: KR_ID, name: 'K R Medical Agency' }),
  ]);
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
  vi.mocked(fetchAllMedicines).mockResolvedValue([medicineRow()]);
});
afterEach(() => resetMedicalRoutes());

describe('PurchasesPage', () => {
  it('lists the orders the API answers under the Medical toolbar, in rupees, ending with "All purchase orders loaded"', async () => {
    const { container } = renderPurchases();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(listPurchaseOrders).toHaveBeenCalledWith(
      { q: undefined, stage: undefined, created: undefined },
      undefined,
    );
    expect(rowOf('#431')).toHaveTextContent('Ankur Pharma');
    expect(rowOf('#431')).toHaveTextContent('Azelaic gel 15g');
    expect(rowOf('#431')).toHaveTextContent('₹4,236');
    expect(rowOf('#431')).toHaveTextContent('₹3,409 paid');
    expect(rowOf('#430')).toHaveTextContent('Ordered');
    expect(rowOf('#428')).toHaveTextContent('₹1,296');
    await waitFor(() =>
      expect(screen.getByTestId('medical-purchases-table-footer')).toHaveTextContent(
        '3 orders',
      ),
    );
    expect(screen.getByTestId('medical-purchases-table-end')).toHaveTextContent(
      'All purchase orders loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-purchases-tab-purchases',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a received order’s "Pay ₹827" opens Send payment on its bill (Q-M1)', async () => {
    const user = setup();
    const { router } = renderPurchases();
    const pay = await screen.findByTestId('medical-purchases-row-action-pay');
    expect(pay).toHaveAccessibleName('Pay ₹827');
    await user.click(pay);
    await waitFor(() => expect(router.state.location.pathname).toBe(PAY));
    expect(router.state.location.search).toEqual({ bill: TEST_PURCHASE_ORDER_ID });
  });

  it('"Pay all received · ₹2,980" with Stage Received opens the Suppliers owed something', async () => {
    const user = setup();
    const { router } = renderPurchases(`${ROOM}?stage=received`);
    const action = await screen.findByTestId(
      'medical-purchases-view-action-pay-received',
    );
    // What the suppliers owed something are owed, over every page.
    expect(medicalListSummary).toHaveBeenCalledWith('suppliers', { hasPayable: true });
    expect(action).toHaveAccessibleName('Pay all received · ₹2,980');
    await user.click(action);
    await waitFor(() => expect(router.state.location.pathname).toBe(SUPPLIERS));
    expect(router.state.location.search).toMatchObject({ payable: 'owed' });
  });

  it('"Pay all received" waits for something to be owed', async () => {
    vi.mocked(medicalListSummary).mockResolvedValue({ total: 0, payable: 0 });
    renderPurchases(`${ROOM}?stage=received`);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(
      screen.queryByTestId('medical-purchases-view-action-pay-received'),
    ).not.toBeInTheDocument();
  });

  it('an Ordered order receives, edits and — for an Admin — cancels with a reason', async () => {
    const user = setup();
    const { router } = renderPurchases();
    await user.click(await screen.findByTestId('medical-purchases-row-action-cancel'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Cancel this purchase order?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('K R Medical Agency · ₹4,236');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));

    await user.click(screen.getByTestId('medical-purchases-row-action-receive'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/${ORDERED_ID}/receive`),
    );
    expect(await screen.findByTestId('receive-goods-drawer')).toBeInTheDocument();
    expect(fetchPurchaseOrder).toHaveBeenCalledWith(ORDERED_ID);
  });

  it('opens New purchase order, and an Ordered order’s view as its edit', async () => {
    const first = renderPurchases(`${ROOM}/create`);
    await waitFor(() =>
      expect(screen.getByTestId('purchase-order-drawer-supplier')).toHaveTextContent(
        'Akshar Medicines',
      ),
    );
    first.unmount();
    renderPurchases(`${ROOM}/${ORDERED_ID}`, 'accountant');
    const drawer = await screen.findByTestId('purchase-order-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('purchase-order-drawer-title')).toHaveTextContent(
        'Edit purchase order',
      ),
    );
  });

  it('editing or receiving an order past Ordered shows its view instead (S:59)', async () => {
    const { router } = renderPurchases(`${ROOM}/${TEST_PURCHASE_ORDER_ID}/edit`);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/${TEST_PURCHASE_ORDER_ID}`),
    );
    const view = await screen.findByTestId('purchase-order-view-drawer');
    expect(within(view).getByTestId('purchase-order-view-drawer-save')).toHaveTextContent(
      'Pay ₹827',
    );
  });

  it('an Accountant sees the orders but receives none', async () => {
    renderPurchases(ROOM, 'accountant');
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(
      screen.queryByTestId('medical-purchases-row-action-receive'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('medical-purchases-row-action-view')).toHaveLength(2);
  });
});
