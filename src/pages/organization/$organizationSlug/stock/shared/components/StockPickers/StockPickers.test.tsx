import { act, screen } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import { StockItemPicker, StockVendorPicker } from './StockPickers.tsx';

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

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockVendorPicker and StockItemPicker (clinic-stock.md:118, 146, 149)', () => {
  it('lists the clinic vendors with their phone, and the items with what is in stock', async () => {
    const user = setup();
    renderStockDrawer(<Pickers />);
    await user.click(await screen.findByTestId('vendor'));
    expect(
      await screen.findByTestId(`vendor-option-${ref.stockVendor(1)}`),
    ).toHaveTextContent('Ankur Pharma+91 97376 99706');
    // Without a stack to open, no "full details".
    expect(screen.queryByTestId('vendor-create-full')).not.toBeInTheDocument();
    await user.click(screen.getByTestId(`vendor-option-${ref.stockVendor(1)}`));
    expect(screen.getByTestId('vendor')).toHaveTextContent('Ankur Pharma');

    await user.click(screen.getByTestId('item'));
    expect(
      await screen.findByTestId(`item-option-${ref.stockItem(158)}`),
    ).toHaveTextContent('Gauze swabs14 in stock');
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
      vendorRequest.onCreated({
        id: '7a3d8c1e-0000-4000-8000-000000000001',
        name: 'Ankit Traders',
        phone: null,
      } as Parameters<typeof vendorRequest.onCreated>[0]),
    );
    expect(await screen.findByText('Ankit Traders')).toBeInTheDocument();

    await user.click(screen.getByTestId('item'));
    await user.type(await screen.findByRole('combobox'), 'Cotton');
    await user.click(await screen.findByTestId('item-create-full'));
    expect(openChild.mock.calls[1]?.[0]).toMatchObject({
      kind: 'item',
      query: 'Cotton',
      vendorId: '7a3d8c1e-0000-4000-8000-000000000001',
    });
  });
});
