import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchSupplier } from '../../medical-api.ts';
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

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('SupplierDrawer (medical.md:190–206)', () => {
  it('refuses a short mobile, then adds the supplier with its makers', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(
      <SupplierDrawer
        mode="create"
        prefill={{ name: 'Om Pharma', manufacturerIds: [ref.manufacturer(1)] }}
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
    expect(onClose).not.toHaveBeenCalled();

    await user.type(within(drawer).getByTestId(`${D}-phone`), '43210');
    await user.type(within(drawer).getByTestId(`${D}-gst`), '24AAACO1234A1Z5');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Supplier saved');
    expect(
      appFixtures.suppliers.snapshot((row) => row.name === 'Om Pharma')[0],
    ).toMatchObject({
      phone: '+919876543210',
      gstNumber: '24AAACO1234A1Z5',
      manufacturerIds: [ref.manufacturer(1)],
    });
  });

  it('editing shows what is owed, the orders and the Account rows, and offers a new order', async () => {
    const user = setup();
    const onNewOrder = vi.fn();
    // Shree Ramdev has a received order still owed.
    const supplier = await fetchSupplier(ref.supplier(58));
    renderMedicalDrawer(
      <SupplierDrawer
        mode="edit"
        supplier={supplier}
        open
        onClose={vi.fn()}
        onNewOrder={onNewOrder}
      />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit supplier');
    // Owed money: no Delete.
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-account-trigger`));
    expect(within(drawer).getByTestId(`${D}-payable`)).toHaveTextContent(/day/);
    expect(within(drawer).getByTestId(`${D}-orders`)).toHaveTextContent(/order/);
    await waitFor(() =>
      expect(within(drawer).getAllByTestId(`${D}-account-row`).length).toBeGreaterThan(0),
    );
    expect(within(drawer).getByTestId(`${D}-account`)).toHaveTextContent(/PO #\d+/);
    expect(within(drawer).getByTestId(`${D}-account`)).toHaveTextContent(/due/);

    await user.click(within(drawer).getByTestId(`${D}-quick-fill-new-order`));
    expect(onNewOrder).toHaveBeenCalledWith(supplier.id);
  });

  it('offers Delete on a supplier with nothing due and no order to settle', async () => {
    const supplier = await fetchSupplier(ref.supplier(52));
    renderMedicalDrawer(
      <SupplierDrawer mode="edit" supplier={supplier} open onClose={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(supplier.payable).toBe(0);
    expect(supplier.hasOpenOrder).toBe(false);
    expect(within(drawer).getByTestId(`${D}-delete`)).toBeInTheDocument();
  });

  it('stacked: "Back" · "Add supplier", the new supplier handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
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
});
