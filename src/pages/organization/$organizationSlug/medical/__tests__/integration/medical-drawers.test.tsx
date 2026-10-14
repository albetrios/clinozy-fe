import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  updateSupplier: vi.fn(),
  updateManufacturer: vi.fn(),
  updateMedicalRep: vi.fn(),
  logMrVisit: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  cancelPurchaseOrder: vi.fn(),
  restorePurchaseOrder: vi.fn(),
  collectSale: vi.fn(),
  returnSale: vi.fn(),
}));
vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicines: vi.fn(),
  fetchAllMedicines: vi.fn(),
  fetchMedicine: vi.fn(),
  updateMedicine: vi.fn(),
  deleteMedicine: vi.fn(),
  restoreMedicine: vi.fn(),
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

import {
  deleteMedicine,
  fetchMedicine,
  updateMedicine,
} from '@/shared/api/app/medicines-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  mrVisitRow,
  TEST_MAKER_ID,
  TEST_MEDICINE_ID,
  TEST_MR_ID,
  TEST_PURCHASE_ORDER_ID,
  TEST_SALE_ID,
  TEST_SALE_INVOICE_ITEM_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import { ManufacturersPage } from '../../manufacturers/ManufacturersPage.tsx';
import { MedicinesPage } from '../../medicines/MedicinesPage.tsx';
import { MrsPage } from '../../mrs/MrsPage.tsx';
import { PurchasesPage } from '../../purchases/PurchasesPage.tsx';
import { SalesPage } from '../../sales/SalesPage.tsx';
import {
  fetchManufacturer,
  fetchMedicalRep,
  fetchMedicalSale,
  fetchPurchaseOrder,
  fetchSupplier,
} from '../../shared/medical-api.ts';
import type { SaleRow } from '../../shared/medical-contracts.ts';
import {
  cancelPurchaseOrder,
  collectSale,
  logMrVisit,
  returnSale,
  updateManufacturer,
  updateMedicalRep,
  updatePurchaseOrder,
  updateSupplier,
} from '../../shared/medical-records-api.ts';
import { SuppliersPage } from '../../suppliers/SuppliersPage.tsx';
import {
  AZELAIC,
  MEDICAL_ROOM_NOW,
  MEDICAL_ROOM_URL as ROOM,
  MEDICAL_ROW_COUNTS,
  NH_PHARMA,
  NH_PHARMA_ID,
  ORDERED_ORDER,
  ORDERED_ORDER_ID,
  PAID_SALE,
  PAID_SALE_ID,
  primeMedicalRoom,
  RAKESH,
  RAKESH_ID,
  SUN_PHARMA,
  TRICHOSPIRE_ID,
  UNPAID_SALE,
  ZEN_ID,
} from './medical-room-test-data.ts';
import {
  type MedicalTestTab,
  renderMedicalRoutes,
  resetMedicalRoutes,
} from './medical-test-router.tsx';

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
};

const rowOf = (tab: MedicalTestTab, text: string) => {
  const row = screen
    .getAllByTestId(`medical-${tab}-table-row`)
    .find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};
/** A row's inline action button, by its id. */
const action = (tab: MedicalTestTab, text: string, id: string) =>
  within(rowOf(tab, text)).getByTestId(`medical-${tab}-row-action-${id}`);
/** A row's action ids, in order. */
const actionsOf = (tab: MedicalTestTab, text: string) =>
  within(rowOf(tab, text))
    .queryAllByTestId(/-row-action-/)
    .map((button) => button.dataset.testid?.split('-row-action-')[1]);

/** Open the room at `path` under `tab`, its rows listed and every read it makes answered. */
async function openAt(tab: MedicalTestTab, path: string) {
  const view = renderMedicalRoutes(`${ROOM}/${path}`, PAGES);
  await waitFor(() =>
    expect(screen.getAllByTestId(`medical-${tab}-table-row`)).toHaveLength(
      MEDICAL_ROW_COUNTS[tab],
    ),
  );
  await waitFor(() => expect(view.queryClient.isFetching()).toBe(0));
  return view;
}

/** A drawer once its record is read: the shell shimmers until then. */
async function loadedDrawer(testId: string) {
  const drawer = await screen.findByTestId(testId);
  await waitFor(() =>
    expect(within(drawer).queryByTestId(`${testId}-skeleton`)).not.toBeInTheDocument(),
  );
  return drawer;
}

/** Retype a text field: clear it, then paste — one change, as the user's edit. */
async function retype(user: ReturnType<typeof setup>, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

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

describe('Medical › Medicines drawers', () => {
  it('Edit medicine opens from its URL and from a row; Save sends the change with its key, keeping the list’s search', async () => {
    const user = setup();
    vi.mocked(updateMedicine).mockImplementation(async (record, input) => ({
      ...record,
      composition: input.composition,
    }));
    const { router } = await openAt(
      'medicines',
      `medicines/${TRICHOSPIRE_ID}/edit?q=tri`,
    );
    const deepLinked = await loadedDrawer('medicine-drawer');
    expect(within(deepLinked).getByTestId('medicine-drawer-title')).toHaveTextContent(
      'Edit medicine',
    );
    expect(within(deepLinked).getByTestId('medicine-drawer-tag')).toHaveTextContent(
      '#461',
    );
    expect(fetchMedicine).toHaveBeenCalledWith(TRICHOSPIRE_ID);
    await user.click(within(deepLinked).getByTestId('medicine-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/medicines`));
    expect(router.state.location.search).toMatchObject({ q: 'tri' });

    await user.click(
      within(rowOf('medicines', 'Azelaic gel')).getByText('Azelaic gel 15g'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/medicines/${TEST_MEDICINE_ID}/edit`,
      ),
    );
    const drawer = await loadedDrawer('medicine-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('medicine-drawer-tag')).toHaveTextContent('#458'),
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await retype(
      user,
      within(drawer).getByTestId('medicine-drawer-composition'),
      'Azelaic acid 20%',
    );
    await user.click(within(drawer).getByTestId('medicine-drawer-save'));
    await waitFor(() =>
      expect(updateMedicine).toHaveBeenCalledWith(
        AZELAIC,
        expect.objectContaining({ composition: 'Azelaic acid 20%' }),
        expect.any(String),
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/medicines`));
    expect(router.state.location.search).toMatchObject({ q: 'tri' });
    expect(notifyMock.success).toHaveBeenCalledWith('Saved Azelaic gel 15g');
  });

  it('New medicine opens from its URL with the search’s name', async () => {
    await openAt('medicines', 'medicines/create?name=Azel%20cream');
    const drawer = await screen.findByTestId('medicine-drawer');
    expect(within(drawer).getByTestId('medicine-drawer-title')).toHaveTextContent(
      'New medicine',
    );
    expect(within(drawer).getByTestId('medicine-drawer-name')).toHaveValue('Azel cream');
  });

  it('a row’s Delete asks for a reason in its confirm, deletes, and offers Undo', async () => {
    const user = setup();
    vi.mocked(deleteMedicine).mockResolvedValue(undefined);
    await openAt('medicines', 'medicines');
    await user.click(action('medicines', 'Trichospire', 'delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this medicine?');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteMedicine).toHaveBeenCalledWith(TRICHOSPIRE_ID, 'duplicate', null),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Trichospire Hair Kit deleted',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });
});

describe('Medical › Purchases drawers', () => {
  it('an Ordered order opens for editing from its URL; Save sends the change with its key', async () => {
    const user = setup();
    vi.mocked(updatePurchaseOrder).mockImplementation(async ({ record }) => ({
      ...record,
      supplierBillNo: 'NH-77',
    }));
    const { router } = await openAt('purchases', `purchases/${ORDERED_ORDER_ID}/edit`);
    const drawer = await loadedDrawer('purchase-order-drawer');
    expect(fetchPurchaseOrder).toHaveBeenCalledWith(ORDERED_ORDER_ID);
    expect(within(drawer).getByTestId('purchase-order-drawer-title')).toHaveTextContent(
      'Edit purchase order',
    );
    expect(within(drawer).getByTestId('purchase-order-drawer-tag')).toHaveTextContent(
      '#430',
    );
    await user.type(within(drawer).getByTestId('purchase-order-drawer-bill-no'), 'NH-77');
    await user.click(within(drawer).getByTestId('purchase-order-drawer-save'));
    await waitFor(() =>
      expect(updatePurchaseOrder).toHaveBeenCalledWith({
        record: ORDERED_ORDER,
        input: expect.objectContaining({ supplierBillNo: 'NH-77' }),
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/purchases`));
  });

  it('a row opens its order: an Ordered one for editing, a received one as its view', async () => {
    const user = setup();
    const { router } = await openAt('purchases', 'purchases');
    await user.click(within(rowOf('purchases', '#430')).getByText('NH Pharma'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/purchases/${ORDERED_ORDER_ID}/edit`,
      ),
    );
    const edit = await loadedDrawer('purchase-order-drawer');
    await user.click(within(edit).getByTestId('purchase-order-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/purchases`));

    await user.click(within(rowOf('purchases', '#431')).getByText('Ankur Pharma'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/purchases/${TEST_PURCHASE_ORDER_ID}`,
      ),
    );
    const view = await loadedDrawer('purchase-order-view-drawer');
    expect(within(view).getByTestId('purchase-order-view-drawer-save')).toHaveTextContent(
      'Pay ₹827',
    );
  });

  it('cancels an order with unsaved edits in one reason confirm — no "Discard changes?" after it (L-64)', async () => {
    const user = setup();
    vi.mocked(cancelPurchaseOrder).mockResolvedValue(undefined);
    const { router } = await openAt('purchases', `purchases/${ORDERED_ORDER_ID}/edit`);
    const drawer = await loadedDrawer('purchase-order-drawer');
    await user.type(within(drawer).getByTestId('purchase-order-drawer-bill-no'), '9');
    await user.click(within(drawer).getByTestId('purchase-order-drawer-delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Cancel this purchase order?');
    await user.click(within(confirm).getByTestId('confirm-reason-mistake'));
    const asked: string[] = [];
    const observer = new MutationObserver(() => {
      for (const node of document.querySelectorAll('[role="alertdialog"]')) {
        asked.push(node.textContent ?? '');
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await user.click(within(confirm).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/purchases`));
    observer.disconnect();
    expect(cancelPurchaseOrder).toHaveBeenCalledWith(ORDERED_ORDER_ID, 'mistake', null);
    expect(asked.some((text) => text.includes('Discard changes?'))).toBe(false);
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'PO #430 cancelled',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });
});

describe('Medical › Suppliers and Manufacturers drawers', () => {
  it('Edit supplier opens from a row and saves what changed with its key; from its URL it starts a new order', async () => {
    const user = setup();
    vi.mocked(updateSupplier).mockImplementation(async ({ record, input }) => ({
      ...record,
      gstNumber: input.gstNumber,
    }));
    const { router } = await openAt('suppliers', 'suppliers');
    await user.click(within(rowOf('suppliers', 'NH Pharma')).getByText('NH Pharma'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/suppliers/${NH_PHARMA_ID}/edit`,
      ),
    );
    const drawer = await loadedDrawer('supplier-drawer');
    expect(fetchSupplier).toHaveBeenCalledWith(NH_PHARMA_ID);
    expect(within(drawer).getByTestId('supplier-drawer-title')).toHaveTextContent(
      'Edit supplier',
    );
    await user.type(within(drawer).getByTestId('supplier-drawer-gst'), '24AAACN0000A1Z5');
    await user.click(within(drawer).getByTestId('supplier-drawer-save'));
    await waitFor(() =>
      expect(updateSupplier).toHaveBeenCalledWith({
        record: NH_PHARMA,
        input: expect.objectContaining({ gstNumber: '24AAACN0000A1Z5' }),
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/suppliers`));
    cleanup();
    resetMedicalRoutes();

    const deepLinked = await openAt('suppliers', `suppliers/${TEST_SUPPLIER_ID}/edit`);
    await loadedDrawer('supplier-drawer');
    await user.click(await screen.findByTestId('supplier-drawer-quick-fill-new-order'));
    await waitFor(() =>
      expect(deepLinked.router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    expect(deepLinked.router.state.location.search).toMatchObject({
      supplier: TEST_SUPPLIER_ID,
    });
  });

  it('Edit manufacturer opens from its URL — Delete only on a maker no medicine names — and from a row, saving with its key', async () => {
    const user = setup();
    vi.mocked(updateManufacturer).mockImplementation(async ({ record, input }) => ({
      ...record,
      name: input.name,
    }));
    const { router } = await openAt('manufacturers', `manufacturers/${ZEN_ID}/edit`);
    const unused = await loadedDrawer('manufacturer-drawer');
    expect(fetchManufacturer).toHaveBeenCalledWith(ZEN_ID);
    expect(within(unused).getByTestId('manufacturer-drawer-name')).toHaveValue('ZEN');
    expect(within(unused).getByTestId('manufacturer-drawer-delete')).toBeInTheDocument();
    expect(actionsOf('manufacturers', 'ZEN')).toEqual(['edit', 'delete']);
    expect(actionsOf('manufacturers', 'SUN PHARMA')).toEqual(['edit']);
    await user.click(within(unused).getByTestId('manufacturer-drawer-dismiss'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/manufacturers`),
    );

    await user.click(
      within(rowOf('manufacturers', 'SUN PHARMA')).getByText('SUN PHARMA'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/manufacturers/${TEST_MAKER_ID}/edit`,
      ),
    );
    const drawer = await loadedDrawer('manufacturer-drawer');
    expect(within(drawer).getByTestId('manufacturer-drawer-title')).toHaveTextContent(
      'Edit manufacturer',
    );
    expect(within(drawer).queryByTestId('manufacturer-drawer-delete')).toBeNull();
    await retype(
      user,
      within(drawer).getByTestId('manufacturer-drawer-name'),
      'sun pharma labs',
    );
    await user.click(within(drawer).getByTestId('manufacturer-drawer-save'));
    await waitFor(() =>
      expect(updateManufacturer).toHaveBeenCalledWith({
        record: SUN_PHARMA,
        input: expect.objectContaining({ name: 'SUN PHARMA LABS' }),
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/manufacturers`),
    );
  });
});

describe('Medical › MRs drawers', () => {
  it('Edit MR opens from its URL and saves the change with its key; a row opens it too', async () => {
    const user = setup();
    vi.mocked(updateMedicalRep).mockImplementation(async ({ record, input }) => ({
      ...record,
      name: input.name,
    }));
    const { router } = await openAt('mrs', `mrs/${RAKESH_ID}/edit`);
    const drawer = await loadedDrawer('rep-drawer');
    expect(fetchMedicalRep).toHaveBeenCalledWith(RAKESH_ID);
    expect(within(drawer).getByTestId('rep-drawer-title')).toHaveTextContent('Edit MR');
    await retype(user, within(drawer).getByTestId('rep-drawer-name'), 'Rakesh Patel');
    await user.click(within(drawer).getByTestId('rep-drawer-save'));
    await waitFor(() =>
      expect(updateMedicalRep).toHaveBeenCalledWith({
        record: RAKESH,
        input: expect.objectContaining({ name: 'Rakesh Patel' }),
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/mrs`));

    await user.click(within(rowOf('mrs', 'Rahul Mehta')).getByText('Rahul Mehta'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/mrs/${TEST_MR_ID}/edit`),
    );
    const fromRow = await loadedDrawer('rep-drawer');
    expect(within(fromRow).getByTestId('rep-drawer-name')).toHaveValue('Rahul Mehta');
  });

  it('a row’s "Log visit" opens Log MR visit, which logs the visit with its key', async () => {
    const user = setup();
    vi.mocked(logMrVisit).mockResolvedValue(mrVisitRow());
    const { router } = await openAt('mrs', 'mrs');
    await user.click(action('mrs', 'Rahul Mehta', 'log-visit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/mrs/${TEST_MR_ID}/visits/create`,
      ),
    );
    const drawer = await loadedDrawer('rep-visit-drawer');
    await waitFor(() => expect(drawer).toHaveTextContent('Rahul Mehta'));
    await user.click(within(drawer).getByTestId('rep-visit-drawer-step-details-trigger'));
    await user.type(
      within(drawer).getByTestId('rep-visit-drawer-samples'),
      '4 tubes Azelan',
    );
    await user.click(within(drawer).getByTestId('rep-visit-drawer-save'));
    await waitFor(() =>
      expect(logMrVisit).toHaveBeenCalledWith({
        input: expect.objectContaining({ mrId: TEST_MR_ID, samples: '4 tubes Azelan' }),
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/mrs`));
  });
});

describe('Medical › Sales drawers', () => {
  it('a row opens the Sale, whose "Collect ₹1,300" records the due with its key; Close keeps the list’s filter', async () => {
    const user = setup();
    vi.mocked(collectSale).mockResolvedValue(ledgerRow({ amount: 1300 }));
    const { router } = await openAt('sales', 'sales?status=unpaid');
    await user.click(within(rowOf('sales', 'Priya Shah')).getByText('Priya Shah'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/sales/${TEST_SALE_ID}`),
    );
    expect(router.state.location.search).toMatchObject({ status: 'unpaid' });
    const drawer = await loadedDrawer('sale-drawer');
    expect(fetchMedicalSale).toHaveBeenCalledWith(TEST_SALE_ID);
    expect(within(drawer).getByTestId('sale-drawer-tag')).toHaveTextContent('#978');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    const collect = within(drawer).getByTestId('sale-drawer-save');
    expect(collect).toHaveTextContent('Collect ₹1,300');
    await user.click(collect);
    await waitFor(() =>
      expect(collectSale).toHaveBeenCalledWith({
        sale: UNPAID_SALE,
        mode: 'upi',
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        '₹1,300 received',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    await user.click(within(drawer).getByTestId('sale-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/sales`));
    expect(router.state.location.search).toMatchObject({ status: 'unpaid' });
  });

  it('Return from patient opens from its URL and from a row; the refund goes with its key', async () => {
    const user = setup();
    const returned: SaleRow = {
      ...PAID_SALE,
      status: 'returned',
      returned: 1300,
      returns: [
        {
          id: 'msrt_back00000000000000000',
          reason: 'unused',
          refundMode: 'cash',
          note: null,
          amount: 1300,
          creditNoteId: 'icn_back00000000000000000',
          pendingCreditId: null,
          items: [
            {
              invoiceItemId: TEST_SALE_INVOICE_ITEM_ID,
              qty: 2,
              amount: 1300,
              restocked: true,
            },
          ],
          returnedById: null,
          at: MEDICAL_ROOM_NOW.toISOString(),
        },
      ],
    };
    vi.mocked(returnSale).mockResolvedValue(returned);
    const { router } = await openAt('sales', `sales/${PAID_SALE_ID}/return`);
    const drawer = await loadedDrawer('sale-return-drawer');
    expect(fetchMedicalSale).toHaveBeenCalledWith(PAID_SALE_ID);
    expect(within(drawer).getByTestId('sale-return-drawer-title')).toHaveTextContent(
      'Return from patient',
    );
    await user.click(
      within(drawer).getByTestId('sale-return-drawer-quick-fill-everything'),
    );
    await user.click(within(drawer).getByTestId('sale-return-drawer-save'));
    await waitFor(() =>
      expect(returnSale).toHaveBeenCalledWith({
        id: PAID_SALE_ID,
        input: {
          lines: [{ invoiceItemId: TEST_SALE_INVOICE_ITEM_ID, qty: 2 }],
          reason: 'unused',
          mode: 'cash',
          note: null,
        },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/sales`));
    expect(notifyMock.success).toHaveBeenCalledWith('₹1,300 refunded · stock added back');

    await user.click(action('sales', 'Rhea Shah', 'return'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/sales/${PAID_SALE_ID}/return`),
    );
    expect(await screen.findByTestId('sale-return-drawer')).toBeInTheDocument();
  });
});
