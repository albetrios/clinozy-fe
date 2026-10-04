import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchStockVendor } from '../../stock-api.ts';
import { StockVendorDrawer } from './StockVendorDrawer.tsx';

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

const D = 'stock-vendor-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockVendorDrawer (clinic-stock.md:174–185)', () => {
  it('asks for a name, refuses a short mobile, then adds the vendor', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<StockVendorDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'New clinic vendor',
    );
    expect(drawer).toHaveTextContent(
      'Supplies consumables for procedures · not medicines',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ankit Traders');
    await user.type(within(drawer).getByTestId(`${D}-phone`), '98765');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a 10-digit mobile');
    expect(onClose).not.toHaveBeenCalled();

    await user.type(within(drawer).getByTestId(`${D}-phone`), '43210');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor Ankit Traders added');
    expect(
      clinicFixtures.stockVendors.snapshot((row) => row.name === 'Ankit Traders')[0],
    ).toMatchObject({ phone: '+919876543210' });
  });

  it('stacked: named from the picker, "Back" · "Add vendor", the vendor handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    renderStockDrawer(
      <StockVendorDrawer
        mode="create"
        open
        onClose={vi.fn()}
        stacked
        prefill={{ name: ' Ankit ' }}
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-name`)).toHaveValue('Ankit');
    expect(within(drawer).getByTestId(`${D}-stacked-dismiss`)).toHaveTextContent('Back');
    expect(within(drawer).getByTestId(`${D}-stacked-save`)).toHaveTextContent(
      'Add vendor',
    );
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ankit' })),
    );
  });

  it('edits a vendor; Delete shows only while nothing is owed', async () => {
    const user = setup();
    const onClose = vi.fn();
    // Ibreia has no purchases.
    const ibreia = await fetchStockVendor(ref.stockVendor(4));
    const view = renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={ibreia} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Edit clinic vendor',
    );
    expect(within(drawer).getByTestId(`${D}-phone`)).toHaveValue('82384 50007');
    expect(within(drawer).getByTestId(`${D}-delete`)).toBeInTheDocument();

    await user.clear(within(drawer).getByTestId(`${D}-name`));
    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ibreia Labs');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor saved');
    view.unmount();

    // Cranix Pharma is owed ₹1,710.
    const cranix = await fetchStockVendor(ref.stockVendor(2));
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={cranix} open onClose={vi.fn()} />,
    );
    const owed = await screen.findByTestId(D);
    expect(within(owed).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('opens view only for a member who may not edit stock', async () => {
    const ibreia = await fetchStockVendor(ref.stockVendor(4));
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={ibreia} open onClose={vi.fn()} />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument(),
    );
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('waits for the vendor while its record loads', async () => {
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(D)).toHaveTextContent('Edit clinic vendor');
  });
});
