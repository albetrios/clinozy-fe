import { act, screen } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
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
import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import { fetchAllStockItems, fetchAllStockVendors } from '../../stock-api.ts';
import { StockItemPicker, StockVendorPicker } from './StockPickers.tsx';

const GAUZE = 'sitm_gauze000000000000000';
const ANKIT = 'svnd_ankit000000000000000';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** Both pickers on one form, as an item drawer and a purchase line hold them. */
function Pickers({ openChild }: { openChild?: OpenStockChild }) {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  return (
    <>
      <StockVendorPicker
        label="Supplier"
        value={vendorId}
        onChange={setVendorId}
        openChild={openChild}
        testId="vendor"
      />
      <StockItemPicker
        label="Item"
        value={itemId}
        onChange={setItemId}
        openChild={openChild}
        vendorId={vendorId}
        testId="item"
      />
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAllStockVendors).mockResolvedValue([stockVendorRow()]);
  vi.mocked(fetchAllStockItems).mockResolvedValue([
    stockItemRow({
      id: GAUZE,
      name: 'Gauze swabs',
      category: 'consumables',
      unit: 'pack',
      qtyMilli: 14_000,
    }),
  ]);
});
afterEach(() => resetStockRoutes());

describe('StockVendorPicker and StockItemPicker (clinic-stock.md:118, 146, 149)', () => {
  it('lists the clinic vendors with their phone, and the items with what is in stock', async () => {
    const user = setup();
    renderStockDrawer(<Pickers />);
    await user.click(await screen.findByTestId('vendor'));
    expect(
      await screen.findByTestId(`vendor-option-${TEST_STOCK_VENDOR_ID}`),
    ).toHaveTextContent('Ankur Pharma+91 98765 00011');
    // Without a stack to open, no "full details".
    expect(screen.queryByTestId('vendor-create-full')).not.toBeInTheDocument();
    await user.click(screen.getByTestId(`vendor-option-${TEST_STOCK_VENDOR_ID}`));
    expect(screen.getByTestId('vendor')).toHaveTextContent('Ankur Pharma');

    await user.click(screen.getByTestId('item'));
    expect(await screen.findByTestId(`item-option-${GAUZE}`)).toHaveTextContent(
      'Gauze swabs14 in stock',
    );
  });

  it('asks the stack for a new vendor, then a new item from that vendor, each picked once saved', async () => {
    const user = setup();
    const openChild = vi.fn<OpenStockChild>();
    renderStockDrawer(<Pickers openChild={openChild} />);

    await user.click(await screen.findByTestId('vendor'));
    await user.type(await screen.findByRole('combobox'), 'Ankit');
    await user.click(await screen.findByTestId('vendor-create-full'));
    const vendorRequest = openChild.mock.calls[0]?.[0];
    expect(vendorRequest).toMatchObject({ kind: 'vendor', query: 'Ankit' });
    if (vendorRequest?.kind !== 'vendor') throw new Error('no vendor request');
    act(() =>
      vendorRequest.onCreated(
        stockVendorRow({ id: ANKIT, name: 'Ankit Traders', phone: null, payable: 0 }),
      ),
    );
    expect(await screen.findByText('Ankit Traders')).toBeInTheDocument();

    await user.click(screen.getByTestId('item'));
    await user.type(await screen.findByRole('combobox'), 'Cotton');
    await user.click(await screen.findByTestId('item-create-full'));
    expect(openChild.mock.calls[1]?.[0]).toMatchObject({
      kind: 'item',
      query: 'Cotton',
      vendorId: ANKIT,
    });
  });
});
