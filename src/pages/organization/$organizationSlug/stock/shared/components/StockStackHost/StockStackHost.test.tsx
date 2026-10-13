import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
}));
vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createStockVendor: vi.fn(),
  quickCreateStockItem: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  stockItemRow,
  stockVendorRow,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import {
  type StockStackRequest,
  useStockStack,
} from '../../hooks/useStockStack/index.ts';
import { fetchAllStockItems, fetchAllStockVendors } from '../../stock-api.ts';
import type { StockItemRecord, StockVendorRecord } from '../../stock-contracts.ts';
import { createStockVendor, quickCreateStockItem } from '../../stock-records-api.ts';
import { StockStackHost } from './StockStackHost.tsx';

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

const VENDOR = 'stock-vendor-drawer-stacked';
const ITEM = 'stock-new-item-drawer-stacked';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** A drawer's picker asking for a stacked child, and the host showing it. */
function Host({ request }: { request: StockStackRequest }) {
  const stack = useStockStack();
  return (
    <>
      <button type="button" onClick={() => stack.open(request)}>
        Full details
      </button>
      <StockStackHost stack={stack} />
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchAllStockItems).mockResolvedValue([stockItemRow()]);
  vi.mocked(fetchAllStockVendors).mockResolvedValue([stockVendorRow()]);
});
afterEach(() => resetStockRoutes());

describe('StockStackHost (clinic-stock.md:174–201, 275–287)', () => {
  it('stacks New clinic vendor named from the picker; Esc closes the child', async () => {
    const user = setup();
    renderStockDrawer(
      <Host request={{ kind: 'vendor', query: 'Ankit', onCreated: vi.fn() }} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Full details' }));
    const child = await screen.findByTestId(VENDOR);
    expect(within(child).getByTestId(`${VENDOR}-title`)).toHaveTextContent(
      'New clinic vendor',
    );
    expect(within(child).getByTestId(`${VENDOR}-name`)).toHaveValue('Ankit');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId(VENDOR)).not.toBeInTheDocument());
  });

  it('the new vendor’s save hands the vendor back to the field that asked', async () => {
    const user = setup();
    const saved = stockVendorRow({ name: 'Ankit Traders', payable: 0 });
    vi.mocked(createStockVendor).mockResolvedValue(saved);
    const onCreated = vi.fn<(record: StockVendorRecord) => void>();
    renderStockDrawer(
      <Host request={{ kind: 'vendor', query: 'Ankit Traders', onCreated }} />,
    );
    await user.click(await screen.findByRole('button', { name: 'Full details' }));
    const child = await screen.findByTestId(VENDOR);
    await user.click(within(child).getByTestId(`${VENDOR}-save`));
    await waitFor(() => expect(screen.queryByTestId(VENDOR)).not.toBeInTheDocument());
    expect(createStockVendor).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ name: 'Ankit Traders' }),
      }),
    );
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor Ankit Traders added');
    expect(onCreated).toHaveBeenCalledWith(saved);
  });

  it('stacks New clinic item from the purchase’s vendor, and hands the item back', async () => {
    const user = setup();
    const saved = stockItemRow({ id: 'sitm_cotton00000000000000', name: 'Cotton' });
    vi.mocked(quickCreateStockItem).mockResolvedValue(saved);
    const onCreated = vi.fn<(record: StockItemRecord) => void>();
    renderStockDrawer(
      <Host
        request={{
          kind: 'item',
          query: 'Cotton',
          vendorId: TEST_STOCK_VENDOR_ID,
          onCreated,
        }}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Full details' }));
    const child = await screen.findByTestId(ITEM);
    expect(within(child).getByTestId(`${ITEM}-name`)).toHaveValue('Cotton');
    await user.click(within(child).getByTestId(`${ITEM}-save`));
    await waitFor(() => expect(screen.queryByTestId(ITEM)).not.toBeInTheDocument());
    expect(quickCreateStockItem).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          name: 'Cotton',
          vendorId: TEST_STOCK_VENDOR_ID,
        }),
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(saved);
  });
});
