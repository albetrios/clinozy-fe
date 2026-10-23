import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchSupplierAccount: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  manufacturerRow,
  supplierRow,
  TEST_MAKER_ID,
  TEST_PURCHASE_ORDER_ID,
  TEST_SUPPLIER_CREDIT_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchSupplierAccount,
} from '../../medical-api.ts';
import { createSupplier, updateSupplier } from '../../medical-records-api.ts';
import { SupplierDrawer } from './SupplierDrawer.tsx';

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

const D = 'supplier-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** NH Pharma, owed nothing — one paid order. */
const PAID_UP = supplierRow({
  id: 'sup_nhpharma00000000000000',
  name: 'NH Pharma',
  payable: 0,
  ageingDays: null,
  orderCount: 1,
  orderTotal: 1200,
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
  vi.mocked(fetchSupplierAccount).mockResolvedValue([]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('SupplierDrawer (medical.md:190–206)', () => {
  it('refuses a short mobile, then adds the supplier with its makers', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(createSupplier).mockResolvedValue(supplierRow({ name: 'Om Pharma' }));
    renderMedicalDrawer(
      <SupplierDrawer
        mode="create"
        prefill={{ name: 'Om Pharma', manufacturerIds: [TEST_MAKER_ID] }}
        open
        onClose={onClose}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('New supplier');
    expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue('Om Pharma');
    // No Account and no Quick fill on a new supplier.
    expect(within(drawer).queryByTestId(`${D}-step-account`)).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-quick-fill`)).not.toBeInTheDocument();

    await user.type(within(drawer).getByTestId(`${D}-phone`), '98765');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter a 10-digit mobile');
    expect(createSupplier).not.toHaveBeenCalled();

    await user.type(within(drawer).getByTestId(`${D}-phone`), '43210');
    await user.type(within(drawer).getByTestId(`${D}-gst`), '24AAACO1234A1Z5');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Supplier saved');
    expect(createSupplier).toHaveBeenCalledWith({
      input: {
        name: 'Om Pharma',
        phone: '+919876543210',
        gstNumber: '24AAACO1234A1Z5',
        manufacturerIds: [TEST_MAKER_ID],
      },
      idempotencyKey: expect.any(String),
    });
  });

  // QA-03 (same pattern): the Supplier step read "Complete" over a phone the save refuses.
  it('flags the Supplier step once left with a phone the save would refuse — never done', async () => {
    const user = setup();
    renderMedicalDrawer(
      <SupplierDrawer
        mode="create"
        prefill={{ name: 'Om Pharma' }}
        open
        onClose={vi.fn()}
      />,
    );
    const drawer = await screen.findByTestId(D);
    await user.type(within(drawer).getByTestId(`${D}-phone`), '98765');
    await user.click(within(drawer).getByTestId(`${D}-step-distributes-trigger`));
    expect(within(drawer).getByTestId(`${D}-step-supplier`)).toHaveAttribute(
      'data-status',
      'missing',
    );
    expect(within(drawer).getByTestId(`${D}-step-supplier-trigger`)).toHaveTextContent(
      'Enter a 10-digit mobile',
    );
    expect(createSupplier).not.toHaveBeenCalled();
  });

  it('editing shows what is owed, the orders and the Account rows, offers a new order and Pay', async () => {
    const user = setup();
    const onNewOrder = vi.fn();
    const onPay = vi.fn();
    const supplier = supplierRow();
    vi.mocked(fetchSupplierAccount).mockResolvedValue([
      {
        kind: 'order',
        id: TEST_PURCHASE_ORDER_ID,
        seq: 431,
        billNo: 'T-82370',
        date: '2026-10-05',
        stage: 'received',
        amount: 4236,
        due: 827,
      },
      {
        kind: 'credit',
        id: TEST_SUPPLIER_CREDIT_ID,
        batchNo: '026-312',
        date: '2026-10-04',
        amount: 840,
      },
    ]);
    renderMedicalDrawer(
      <SupplierDrawer
        mode="edit"
        supplier={supplier}
        open
        onClose={vi.fn()}
        onNewOrder={onNewOrder}
        onPay={onPay}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit supplier');
    // Owed money: no Delete.
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-account-trigger`));
    expect(within(drawer).getByTestId(`${D}-payable`)).toHaveTextContent('₹827 · 5 days');
    expect(within(drawer).getByTestId(`${D}-orders`)).toHaveTextContent(
      '2 orders · ₹4,236',
    );
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-account-row`)).toHaveLength(2),
    );
    expect(fetchSupplierAccount).toHaveBeenCalledWith(supplier.id);
    const account = within(drawer).getByTestId(`${D}-account`);
    expect(account).toHaveTextContent('PO #431');
    expect(account).toHaveTextContent('₹827 due');
    expect(account).toHaveTextContent('Credit · 026-312');

    await user.click(within(drawer).getByTestId(`${D}-quick-fill-new-order`));
    expect(onNewOrder).toHaveBeenCalledWith(supplier.id);
    await user.click(within(drawer).getByTestId(`${D}-quick-fill-pay`));
    expect(onPay).toHaveBeenCalledWith(supplier);
  });

  it('saves only what changed, against the record it read', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(updateSupplier).mockResolvedValue(PAID_UP);
    renderMedicalDrawer(
      <SupplierDrawer mode="edit" supplier={PAID_UP} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    const gst = within(drawer).getByTestId(`${D}-gst`);
    await user.clear(gst);
    await user.type(gst, '24AAACN0000A1Z5');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateSupplier).toHaveBeenCalledWith({
      record: PAID_UP,
      input: expect.objectContaining({ gstNumber: '24AAACN0000A1Z5' }),
      idempotencyKey: expect.any(String),
    });
  });

  it('offers Delete, and no Pay, on a supplier owed nothing', async () => {
    renderMedicalDrawer(
      <SupplierDrawer
        mode="edit"
        supplier={PAID_UP}
        open
        onClose={vi.fn()}
        onPay={vi.fn()}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-delete`)).toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-quick-fill-pay`)).not.toBeInTheDocument();
  });

  it('stacked: "Back" · "Add supplier", the new supplier handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    vi.mocked(createSupplier).mockResolvedValue(supplierRow({ name: 'Om Pharma' }));
    renderMedicalDrawer(
      <SupplierDrawer
        mode="create"
        prefill={{ name: 'Om Pharma' }}
        open
        onClose={vi.fn()}
        stacked
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-save`)).toHaveTextContent(
      'Add supplier',
    );
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Om Pharma' }),
      ),
    );
  });

  it('shows the shell while a deep-linked supplier loads', async () => {
    renderMedicalDrawer(
      <SupplierDrawer mode="edit" supplier={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
