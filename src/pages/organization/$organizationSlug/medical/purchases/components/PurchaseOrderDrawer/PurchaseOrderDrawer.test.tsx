import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMedicines: vi.fn(),
}));
vi.mock('../../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
}));
import { fetchAllMedicines } from '@/shared/api/app/medicines-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  manufacturerRow,
  medicineRow,
  purchaseOrderRow,
  supplierRow,
  TEST_MEDICINE_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
} from '../../../shared/medical-api.ts';
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from '../../../shared/medical-records-api.ts';
import { PurchaseOrderDrawer } from './PurchaseOrderDrawer.tsx';

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

const D = 'purchase-order-drawer';
const AKSHAR_ID = 'sup_akshar000000000000000';
const KR_ID = 'sup_krmedical000000000000';

const akshar = (rate: number) => ({
  supplierId: AKSHAR_ID,
  supplierName: 'Akshar Medicines',
  rate,
  free: 0,
  leadDays: 2,
});
const kr = (rate: number) => ({
  supplierId: KR_ID,
  supplierName: 'K R Medical Agency',
  rate,
  free: 0,
  leadDays: 1,
});

/**
 * The store's medicines: Epriva Tab and Azelan (Akshar Medicines' price list) in stock; Arganlif
 * and Admosh low (2 of 10) and Trichospire out — the three "Low stock" chips, most of them bought
 * from K R Medical Agency.
 */
const CATALOGUE = [
  medicineRow({ id: TEST_MEDICINE_ID, name: 'Epriva Tab', supplierRates: [akshar(212)] }),
  medicineRow({
    id: 'med_azelan000000000000000',
    name: 'Azelan 20% Cream',
    supplierRates: [akshar(190)],
    bestRate: { supplierId: AKSHAR_ID, supplierName: 'Akshar Medicines', rate: 190 },
  }),
  medicineRow({
    id: 'med_arganlif0000000000000',
    name: 'Arganlif Hair Serum 50 ml',
    stock: 2,
    maxStock: 10,
    stockLevel: 'low',
    supplierRates: [kr(677)],
    bestRate: { supplierId: KR_ID, supplierName: 'K R Medical Agency', rate: 677 },
  }),
  medicineRow({
    id: 'med_admosh000000000000000',
    name: 'Admosh Lotion',
    stock: 2,
    maxStock: 10,
    stockLevel: 'low',
    supplierRates: [kr(240)],
    bestRate: { supplierId: KR_ID, supplierName: 'K R Medical Agency', rate: 240 },
  }),
  medicineRow({
    id: 'med_trichospire0000000000',
    name: 'Trichospire',
    stock: 0,
    maxStock: 10,
    stockLevel: 'out',
    supplierRates: [kr(310), akshar(320)],
    bestRate: { supplierId: KR_ID, supplierName: 'K R Medical Agency', rate: 310 },
  }),
];

/** PO #430, Ordered: ten Epriva Tab and one free at ₹423.60 — ₹4,236. */
const ORDERED = purchaseOrderRow({
  seq: 430,
  stage: 'ordered',
  apiStage: 'ordered',
  receivedAt: null,
  supplier: { id: AKSHAR_ID, name: 'Akshar Medicines', phone: null, gstNumber: null },
  lines: [
    {
      id: 'mpoi_line00000000000000000',
      lineNo: 1,
      medicineId: TEST_MEDICINE_ID,
      medicineName: 'Epriva Tab',
      qty: 10,
      free: 1,
      rate: 423.6,
      amount: 4236,
      gstPercent: 12,
      gstInclusive: true,
      taxable: 3782.14,
      gst: 453.86,
      received: null,
      batchNo: null,
      expiry: null,
    },
  ],
  paid: 0,
  due: 0,
  paymentStatus: 'unpaid',
});

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(fetchAllMedicines).mockResolvedValue(CATALOGUE);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow({ id: AKSHAR_ID, name: 'Akshar Medicines' }),
    supplierRow({ id: KR_ID, name: 'K R Medical Agency' }),
  ]);
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
  vi.mocked(createPurchaseOrder).mockResolvedValue(ORDERED);
  vi.mocked(updatePurchaseOrder).mockResolvedValue(ORDERED);
});
afterEach(() => resetMedicalRoutes());

describe('PurchaseOrderDrawer (medical.md:254–267)', () => {
  it('opens on the first supplier; "Reorder low stock" fills the lines; a missing rate names its medicine', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<PurchaseOrderDrawer mode="create" open onClose={onClose} />);
    // Prefilled with the first supplier (`medical.md:258`) once the list is read.
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('Akshar Medicines'),
    );
    const drawer = screen.getByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'New purchase order',
    );
    expect(drawer).toHaveTextContent('Order → receive → pay');

    await user.click(within(drawer).getByTestId(`${D}-quick-fill-reorder`));
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(3),
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    const [firstRate] = within(drawer).getAllByTestId(`${D}-lines-rate`);
    if (!firstRate) throw new Error('expected a rate cell');
    await user.clear(firstRate);
    await user.tab();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.warning).toHaveBeenCalledWith(
        'Enter the rate for Arganlif Hair Serum 50 ml',
      ),
    );
    expect(createPurchaseOrder).not.toHaveBeenCalled();

    await user.type(firstRate, '700');
    await user.tab();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase order saved');
    // The lines in rupees, filled up to their fill-up level (10 − 2, 10 − 0).
    expect(createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          supplierId: AKSHAR_ID,
          items: [
            {
              medicineId: 'med_arganlif0000000000000',
              qty: 8,
              free: 0,
              rate: 700,
              gstPercent: 12,
              gstInclusive: true,
            },
            {
              medicineId: 'med_admosh000000000000000',
              qty: 8,
              free: 0,
              rate: 240,
              gstPercent: 12,
              gstInclusive: true,
            },
            {
              medicineId: 'med_trichospire0000000000',
              qty: 10,
              free: 0,
              rate: 320,
              gstPercent: 12,
              gstInclusive: true,
            },
          ],
        }),
      }),
    );
  });

  // QA-04's pattern: an order with no medicine read "Complete" — and was sent for the API to refuse.
  it('keeps Items flagged while no medicine is added — "Add at least one item", never done, never sent', async () => {
    const user = setup();
    renderMedicalDrawer(<PurchaseOrderDrawer mode="create" open onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('Akshar Medicines'),
    );
    const drawer = screen.getByTestId(D);
    const items = () => within(drawer).getByTestId(`${D}-step-items`);
    const head = () => within(drawer).getByTestId(`${D}-step-items-trigger`);
    await user.click(within(drawer).getByTestId(`${D}-step-order-next`));
    await user.click(within(drawer).getByTestId(`${D}-step-order-trigger`));

    expect(items()).toHaveAttribute('data-status', 'missing');
    expect(head()).toHaveTextContent('Add at least one item');
    expect(head()).not.toHaveTextContent('Complete');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.warning).toHaveBeenCalledWith('Add at least one item'),
    );
    expect(createPurchaseOrder).not.toHaveBeenCalled();
    // The save opens Items, where the medicine goes.
    expect(items()).toHaveAttribute('data-status', 'open');
  });

  it('fills the items from the quick line — "azel 20 +2 @180" — the Low stock chips and Browse', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<PurchaseOrderDrawer mode="create" open onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('Akshar Medicines'),
    );
    const drawer = screen.getByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    const line = await within(drawer).findByTestId(`${D}-quick-line-input`);
    expect(line).toHaveAttribute(
      'placeholder',
      'Type medicine, qty, free, rate · e.g. azel 20 +2 @180',
    );
    // The low medicines the order lacks (H:5389): "Arganlif Hair Serum 50 ml · 2 left".
    const chips = () => within(drawer).getByTestId(`${D}-quick-line-frequent`);
    expect(chips()).toHaveTextContent('Low stock');
    expect(within(chips()).getAllByRole('button')).toHaveLength(3);

    // Twenty and two free at ₹180 — the shorthand's pills while it is typed.
    await user.type(line, 'azel 20 +2 @180');
    expect(within(drawer).getByText('+2 free')).toBeVisible();
    expect(within(drawer).getByText('@ ₹180')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId(`${D}-summary`)).toHaveTextContent('₹3,600');
    expect(within(drawer).getAllByTestId(`${D}-lines-free`)[0]).toHaveValue('2');

    // A chip orders the medicine up to its fill-up level at its best rate: 10 − 2 at ₹677.
    await user.click(
      within(chips()).getByRole('button', { name: /Arganlif Hair Serum 50 ml · 2 left/ }),
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-summary`)).toHaveTextContent('₹9,016'),
    );
    expect(within(chips()).getAllByRole('button')).toHaveLength(2);

    // Browse: All · Low stock · From Akshar Medicines · Other medicines; a tap adds one.
    await user.click(within(drawer).getByTestId(`${D}-quick-line-browse`));
    const panel = await screen.findByTestId(`${D}-quick-line-browse-panel`);
    expect(
      within(panel)
        .getAllByRole('button', { pressed: false })
        .concat(within(panel).getAllByRole('button', { pressed: true }))
        .map((button) => button.textContent),
    ).toEqual(
      expect.arrayContaining(['Low stock', 'From Akshar Medicines', 'Other medicines']),
    );
    await user.click(within(panel).getByTestId(`${D}-quick-line-browse-group-low`));
    const tiles = within(panel).getAllByTestId(`${D}-quick-line-browse-tile`);
    expect(tiles).toHaveLength(3);
    expect(tiles.filter((tile) => tile.hasAttribute('data-added'))).toHaveLength(1);
    expect(panel).toHaveTextContent('2 added');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    // "New medicine name": the typed name rides its line — nothing is written yet.
    await user.type(
      within(panel).getByTestId(`${D}-quick-line-browse-new`),
      'Azel cream{Enter}',
    );
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(3),
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-medicine`)[2]).toHaveTextContent(
      'Azel cream',
    );

    // It needs its rate like any line; the save sends its name for the server to add (MD26).
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.warning).toHaveBeenCalledWith('Enter the rate for Azel cream'),
    );
    const rate = within(drawer).getAllByTestId(`${D}-lines-rate`)[2] as HTMLElement;
    await user.type(rate, '150');
    await user.tab();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          items: [
            {
              medicineId: 'med_azelan000000000000000',
              qty: 20,
              free: 2,
              rate: 180,
              gstPercent: 12,
              gstInclusive: true,
            },
            {
              medicineId: 'med_arganlif0000000000000',
              qty: 8,
              free: 0,
              rate: 677,
              gstPercent: 12,
              gstInclusive: true,
            },
            {
              medicineId: null,
              newMedicineName: 'Azel cream',
              qty: 1,
              free: 0,
              rate: 150,
              gstPercent: 12,
              gstInclusive: true,
            },
          ],
        }),
      }),
    );
  });

  it('`?supplier=` names the supplier; `?reorder=low` opens on Items at the supplier most of them use', async () => {
    const first = renderMedicalDrawer(
      <PurchaseOrderDrawer
        mode="create"
        open
        prefill={{ supplierId: KR_ID }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('K R Medical Agency'),
    );
    first.unmount();

    renderMedicalDrawer(
      <PurchaseOrderDrawer
        mode="create"
        open
        prefill={{ reorder: 'low' }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId(`${D}-lines-row`)).toHaveLength(3));
    // The Order step, folded, names the supplier.
    expect(screen.getByTestId(D)).toHaveTextContent('K R Medical Agency');
    // 8 × ₹677 + 8 × ₹240 + 10 × ₹310.
    expect(screen.getByTestId(`${D}-summary`)).toHaveTextContent('₹10,436');
  });

  it('edits an Ordered order — only what changed, with its read — and has the red "Cancel order" for an Admin', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <PurchaseOrderDrawer mode="edit" order={ORDERED} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Edit purchase order',
    );
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#430');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,236');
    // The line's GST and the order's split (feat-purchase-line-gst D3); "GST on top" adds it.
    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    const totals = await within(drawer).findByTestId(`${D}-gst-totals`);
    expect(totals).toHaveTextContent('Taxable ₹3,782.14 · GST ₹453.86');
    await user.click(within(drawer).getByTestId(`${D}-gst-inclusive`));
    expect(totals).toHaveTextContent('Taxable ₹4,236 · GST ₹508.32');
    await user.click(within(drawer).getByTestId(`${D}-gst-inclusive`));
    await user.click(within(drawer).getByTestId(`${D}-step-order-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Cancel this purchase order?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('₹4,236');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));

    const billNo = within(drawer).getByTestId(`${D}-bill-no`);
    await user.clear(billNo);
    await user.type(billNo, 'T-90000');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updatePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        record: ORDERED,
        input: expect.objectContaining({
          supplierBillNo: 'T-90000',
          items: [
            {
              medicineId: TEST_MEDICINE_ID,
              qty: 10,
              free: 1,
              rate: 423.6,
              gstPercent: 12,
              gstInclusive: true,
            },
          ],
        }),
      }),
    );
  });

  it('a Pharmacist edits but cannot cancel; the drawer shimmers until the order is read', async () => {
    const view = renderMedicalDrawer(
      <PurchaseOrderDrawer mode="edit" order={ORDERED} open onClose={vi.fn()} />,
      { role: 'pharmacist' },
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    view.unmount();
    renderMedicalDrawer(
      <PurchaseOrderDrawer mode="edit" order={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
