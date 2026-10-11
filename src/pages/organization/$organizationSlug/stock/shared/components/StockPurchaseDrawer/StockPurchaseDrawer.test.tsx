import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
  fetchStockPurchase: vi.fn(),
}));
vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createStockPurchase: vi.fn(),
  updateStockPurchase: vi.fn(),
  deleteStockPurchase: vi.fn(),
  restoreStockPurchase: vi.fn(),
  quickCreateStockItem: vi.fn(),
}));
import i18n from '@/lib/i18n/i18n.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import * as branchesApi from '@/shared/api/app/branches-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  stockItemRow,
  stockPurchaseRow,
  stockVendorRow,
  TEST_STOCK_PURCHASE_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import {
  fetchAllStockItems,
  fetchAllStockVendors,
  fetchStockPurchase,
} from '../../stock-api.ts';
import type { StockItemRecord } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import {
  createStockPurchase,
  deleteStockPurchase,
  quickCreateStockItem,
  updateStockPurchase,
} from '../../stock-records-api.ts';
import { StockPurchaseDrawer } from './StockPurchaseDrawer.tsx';

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

const D = 'stock-purchase-drawer';
const K = STOCK_DRAWER_KEYS.purchase;
// Public ids as the API sends them (`<prefix>_<21 [a-z0-9]>`).
const GAUZE = 'sitm_gauze0000000000000000';
const D_TAN = 'sitm_dtanmask0000000000000';
const ADAJAN = 'brn_adajan000000000000000';
const VESU = 'brn_vesu00000000000000000';

/** A word of the room as i18next answers it — the copy once merged, its key before. */
const word = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: STOCK_DRAWERS_NS, ...options });

/** Soframycin (OK), Gauze swabs (low: 4 of 10) and D-Tan Mask (out: 0 of 6). */
const ITEMS = [
  stockItemRow(),
  stockItemRow({
    id: GAUZE,
    seq: 12,
    name: 'Gauze swabs',
    category: 'consumables',
    unit: 'pack',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 4000,
    maxQty: 10,
    level: 'low',
  }),
  stockItemRow({
    id: D_TAN,
    seq: 161,
    name: 'D-Tan Mask',
    category: 'masks',
    unit: 'piece',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 0,
    maxQty: 6,
    level: 'out',
  }),
];

/** The member's two branches — Adajan the main one. */
const BRANCHES: branchesApi.BranchOption[] = [
  {
    id: ADAJAN,
    name: 'Adajan',
    tone: 'sky',
    isMain: true,
    opensAt: '10:00',
    closesAt: '19:00',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  },
  {
    id: VESU,
    name: 'Vesu',
    tone: 'mint',
    isMain: false,
    opensAt: '10:00',
    closesAt: '19:00',
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  },
];

/** An unpaid bill #16 — nothing paid on it yet. */
const UNPAID = stockPurchaseRow({
  paid: 0,
  due: 2392.5,
  status: 'unpaid',
  paymentIds: [],
});

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const badges = (drawer: HTMLElement) => within(drawer).getByTestId(`${D}-badges`);
const rates = (drawer: HTMLElement) => within(drawer).getAllByTestId(`${D}-lines-rate`);

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError('refused', status, '/app/stock-purchases', 'POST', { error });

/** A toast's options with an action — the failed save's "Reload". */
type ToastWithAction = { action: { label: string; onClick: () => void } };

/** The failed save's toast that offers "Reload". */
function reloadAction() {
  const call = notifyMock.error.mock.calls.find(
    ([, options]) => (options as Partial<ToastWithAction> | undefined)?.action,
  );
  if (!call) throw new Error('no toast with an action');
  return (call[1] as ToastWithAction).action;
}

/** Pick Ankur Pharma as the supplier. */
async function pickAnkur(user: ReturnType<typeof setup>, drawer: HTMLElement) {
  await user.click(within(drawer).getByTestId(`${D}-vendor`));
  await user.click(
    await screen.findByTestId(`${D}-vendor-option-${TEST_STOCK_VENDOR_ID}`),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchAllStockItems).mockResolvedValue(ITEMS);
  vi.mocked(fetchAllStockVendors).mockResolvedValue([stockVendorRow()]);
  vi.mocked(createStockPurchase).mockResolvedValue(stockPurchaseRow());
  vi.mocked(updateStockPurchase).mockResolvedValue(stockPurchaseRow());
  vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue(BRANCHES);
});
afterEach(() => {
  resetStockRoutes();
  vi.restoreAllMocks();
});

describe('StockPurchaseDrawer (clinic-stock.md:142–157, 247–259)', () => {
  it('asks for the supplier first; reorders the low items; checks each rate; records the bill with its Paid', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('New purchase');
    expect(drawer).toHaveTextContent('Items received are added to stock');
    expect(badges(drawer)).toHaveTextContent('No supplierBill ₹0Paid');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick a supplier');

    await pickAnkur(user, drawer);
    expect(badges(drawer)).toHaveTextContent('Ankur Pharma');
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-quick-fill-reorder`)).toBeEnabled(),
    );
    await user.click(within(drawer).getByTestId(`${D}-quick-fill-reorder`));
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2),
    );
    // Ordered up to each maximum: Gauze 10 − 4, D-Tan 6 − 0.
    expect(
      within(drawer)
        .getAllByTestId(`${D}-lines-qty`)
        .map((qty) => (qty as HTMLInputElement).value),
    ).toEqual(['6', '6']);

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter the rate');
    for (const rate of rates(drawer))
      expect(rate).toHaveAttribute('aria-invalid', 'true');

    // A typed rate takes its cell's red edge away; the other keeps it.
    await user.type(rates(drawer)[0] as HTMLElement, '250');
    expect(rates(drawer)[0]).not.toHaveAttribute('aria-invalid');
    expect(rates(drawer)[1]).toHaveAttribute('aria-invalid', 'true');
    await user.type(rates(drawer)[1] as HTMLElement, '80.5');
    expect(badges(drawer)).toHaveTextContent('Bill ₹1,983₹1,983 due');

    // Paid ₹500 by UPI from Vesu — a supplier-bill payment with the purchase.
    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    await user.type(await within(drawer).findByTestId(`${D}-paid`), '500');
    await user.click(within(drawer).getByTestId(`${D}-paid-mode-upi`));
    await user.click(within(drawer).getByTestId(`${D}-paid-branch-${VESU}`));
    expect(badges(drawer)).toHaveTextContent('Bill ₹1,983₹1,483 due');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createStockPurchase).toHaveBeenCalledWith({
      input: {
        vendorId: TEST_STOCK_VENDOR_ID,
        billNo: null,
        date: appToday(),
        lines: [
          { itemId: GAUZE, qtyMilli: 6000, rate: 250 },
          { itemId: D_TAN, qtyMilli: 6000, rate: 80.5 },
        ],
        bill: null,
        payment: { branchId: VESU, mode: 'upi', amount: 500 },
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase saved · stock updated');
  });

  it('a purchase takes one item at least; "Full" pays the bill typed, in cash from the main branch', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await pickAnkur(user, drawer);
    await user.type(within(drawer).getByTestId(`${D}-bill-no`), ' AP-3001 ');
    expect(within(drawer).getByTestId(`${D}-bill-no`)).toHaveAttribute('maxLength', '30');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(word(K.fields.addLine));
    expect(within(drawer).getByTestId(`${D}-lines-error`)).toHaveTextContent(
      word(K.fields.addLine),
    );
    expect(createStockPurchase).not.toHaveBeenCalled();

    // "gloves 10 @250" on the quick line: the line its rate and all.
    const line = await within(drawer).findByTestId(`${D}-quick-line-input`);
    await user.type(line, 'gauze 2 @45');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(badges(drawer)).toHaveTextContent('Bill ₹90'));
    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-bill`), '100');
    await user.click(within(drawer).getByTestId(`${D}-paid-quick-full`));
    expect(badges(drawer)).toHaveTextContent('Bill ₹100Paid');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(createStockPurchase).mock.calls[0]?.[0].input).toMatchObject({
      billNo: 'AP-3001',
      lines: [{ itemId: GAUZE, qtyMilli: 2000, rate: 45 }],
      bill: 100,
      payment: { branchId: ADAJAN, mode: 'cash', amount: 100 },
    });
  });

  it('without payment:create there is no Paid — the purchase is recorded unpaid', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={onClose} />, {
      role: 'therapist',
    });
    const drawer = await screen.findByTestId(D);
    await pickAnkur(user, drawer);
    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    await user.type(
      await within(drawer).findByTestId(`${D}-quick-line-input`),
      'gauze 1 @45',
    );
    await user.keyboard('{Enter}');
    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    expect(await within(drawer).findByTestId(`${D}-bill`)).toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-paid`)).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-paid-mode`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(createStockPurchase).mock.calls[0]?.[0].input.payment).toBeNull();
  });

  it('a Paid above the bill (409 more_than_due) and a field the API names land on their fields', async () => {
    const user = setup();
    vi.mocked(createStockPurchase)
      .mockRejectedValueOnce(
        refusal(409, {
          reason: 'more_than_due',
          detail: "That is more than the bill's due",
        }),
      )
      .mockRejectedValueOnce(
        refusal(400, {
          type: 'validation_error',
          errors: [{ field: 'body.items/0/rate', message: 'Must be 0.01 or more' }],
        }),
      );
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    await pickAnkur(user, drawer);
    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    await user.type(
      await within(drawer).findByTestId(`${D}-quick-line-input`),
      'gauze 1 @45',
    );
    await user.keyboard('{Enter}');
    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    await user.type(await within(drawer).findByTestId(`${D}-paid`), '999');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(word(K.fields.moreThanBill)),
    );
    expect(within(drawer).getByTestId(`${D}-paid`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(within(drawer).getByTestId(`${D}-step-payment`)).toHaveTextContent(
      word(K.fields.moreThanBill),
    );

    // The API's `items/0/rate` is the first line's Rate: its step opens, its cell says it.
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenLastCalledWith('Must be 0.01 or more'),
    );
    expect(rates(drawer)[0]).toHaveAttribute('aria-invalid', 'true');
  });

  it('a typed name the list lacks becomes a quick clinic item from the bill’s vendor', async () => {
    const user = setup();
    const cotton: StockItemRecord = {
      ...stockItemRow({ id: 'sitm_cotton000000000000000', name: 'Cotton Rolls' }),
    };
    vi.mocked(quickCreateStockItem).mockResolvedValue(cotton);
    renderStockDrawer(<StockPurchaseDrawer mode="create" open onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    await pickAnkur(user, drawer);
    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    const line = await within(drawer).findByTestId(`${D}-quick-line-input`);
    // The low items the bill lacks (H:5276): "Gauze swabs · 4 left".
    expect(within(drawer).getByTestId(`${D}-quick-line-frequent`)).toHaveTextContent(
      'Gauze swabs · 4 left',
    );
    await user.type(line, 'cotton rolls');
    await user.click(await screen.findByTestId(`${D}-quick-line-typed`));
    await waitFor(() =>
      expect(quickCreateStockItem).toHaveBeenCalledWith({
        input: { name: 'Cotton Rolls', vendorId: TEST_STOCK_VENDOR_ID },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(1),
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('`?reorder=low` waits for the items, then opens on the reordered lines', async () => {
    renderStockDrawer(
      <StockPurchaseDrawer
        mode="create"
        prefill={{ reorder: 'low' }}
        open
        onClose={vi.fn()}
      />,
    );
    // The pending drawer gives way to the form once the catalogue is in.
    await waitFor(() => expect(screen.getAllByTestId(`${D}-lines-row`)).toHaveLength(2));
    expect(screen.getByTestId(`${D}-step-items`)).toHaveAttribute('data-state', 'open');
  });

  it('edits a purchase: its lines as received, Paid the server’s; saves the bill’s details with its read', async () => {
    const user = setup();
    const onClose = vi.fn();
    const purchase = stockPurchaseRow();
    renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={purchase} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit purchase');
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#16');
    await waitFor(() =>
      expect(badges(drawer)).toHaveTextContent('Ankur PharmaBill ₹2,392.50₹1,500 due'),
    );
    expect(
      within(drawer).queryByTestId(`${D}-quick-fill-reorder`),
    ).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-items-trigger`));
    expect(await within(drawer).findByTestId(`${D}-lines`)).toHaveTextContent(
      '₹1,252.50',
    );
    expect(within(drawer).queryByTestId(`${D}-lines-add`)).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-quick-line-input`)).not.toBeInTheDocument();
    expect(within(drawer).getByTestId(`${D}-lines-qty`)).toHaveAttribute('readonly');

    await user.click(within(drawer).getByTestId(`${D}-step-payment-trigger`));
    expect(await within(drawer).findByTestId(`${D}-paid`)).toHaveTextContent(
      word(K.fields.paidSoFar, {
        amount: '₹892.50',
        status: i18n.t('purchases.statuses.partial', { ns: STOCK_DRAWERS_NS }),
      }),
    );
    expect(within(drawer).queryByTestId(`${D}-paid-mode`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-bill-trigger`));
    const billNo = await within(drawer).findByTestId(`${D}-bill-no`);
    await user.clear(billNo);
    await user.type(billNo, 'INV-222');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateStockPurchase).toHaveBeenCalledWith({
      record: purchase,
      input: {
        vendorId: TEST_STOCK_VENDOR_ID,
        billNo: 'INV-222',
        date: '2026-10-09',
        bill: 2392.5,
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Purchase saved');
  });

  it('a save over someone else’s (409 record_changed) offers Reload, which reads the purchase again', async () => {
    const user = setup();
    const onClose = vi.fn();
    const fresh = stockPurchaseRow({
      billNo: 'INV-999',
      updatedAt: '2026-10-10T07:30:00.000Z',
    });
    vi.mocked(updateStockPurchase).mockRejectedValueOnce(
      refusal(409, {
        reason: 'record_changed',
        detail: 'This record was changed by usr_x at 2026-10-10T07:30:00.000Z',
      }),
    );
    vi.mocked(fetchStockPurchase).mockResolvedValue(fresh);
    renderStockDrawer(
      <StockPurchaseDrawer
        mode="edit"
        purchase={stockPurchaseRow()}
        open
        onClose={onClose}
      />,
    );
    const drawer = await screen.findByTestId(D);
    const billNo = within(drawer).getByTestId(`${D}-bill-no`);
    await user.clear(billNo);
    await user.type(billNo, 'INV-222');
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    const reload = reloadAction();
    expect(reload.label).toBe('Reload');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => reload.onClick());
    expect(fetchStockPurchase).toHaveBeenCalledWith(TEST_STOCK_PURCHASE_ID);
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-bill-no`)).toHaveValue('INV-999'),
    );

    // The next save is guarded by the fresh read.
    await user.clear(within(drawer).getByTestId(`${D}-bill-no`));
    await user.type(within(drawer).getByTestId(`${D}-bill-no`), 'INV-222');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(updateStockPurchase).mock.calls[1]?.[0].record).toBe(fresh);
  });

  it('Delete: a purchase with money paid on it says why; an unpaid one asks for a reason, with Undo', async () => {
    const user = setup();
    const view = renderStockDrawer(
      <StockPurchaseDrawer
        mode="edit"
        purchase={stockPurchaseRow()}
        open
        onClose={vi.fn()}
      />,
    );
    await user.click(within(await screen.findByTestId(D)).getByTestId(`${D}-delete`));
    expect(notifyMock.info).toHaveBeenCalledWith(
      word(STOCK_DRAWER_KEYS.confirm.blocked.purchasePaid),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    view.unmount();

    const onClose = vi.fn();
    renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={UNPAID} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() => expect(badges(drawer)).toHaveTextContent('₹2,392.50 due'));
    await user.click(within(drawer).getByTestId(`${D}-delete`));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this purchase?');
    expect(confirm).toHaveTextContent('Ankur Pharma');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteStockPurchase).toHaveBeenCalledWith({
      id: TEST_STOCK_PURCHASE_ID,
      reason: 'mistake',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Purchase #16 deleted',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
  });

  it('is view only without Edit, and waits for a purchase still loading', async () => {
    const view = renderStockDrawer(
      <StockPurchaseDrawer
        mode="edit"
        purchase={stockPurchaseRow()}
        open
        onClose={vi.fn()}
      />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument(),
    );
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    view.unmount();
    renderStockDrawer(
      <StockPurchaseDrawer mode="edit" purchase={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(D)).toHaveTextContent('Edit purchase');
  });
});
