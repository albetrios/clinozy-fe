import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { useStockStack } from '../../hooks/useStockStack/index.ts';
import { StockPurchaseDrawer } from '../StockPurchaseDrawer/index.ts';
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

const D = 'stock-purchase-drawer';
const VENDOR = 'stock-vendor-drawer-stacked';
const ITEM = 'stock-new-item-drawer-stacked';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** New purchase with its stacked children, as the Purchases tab hosts them. */
function Host({ onClose }: { onClose: () => void }) {
  const stack = useStockStack();
  return (
    <>
      <StockPurchaseDrawer mode="create" open onClose={onClose} openChild={stack.open} />
      <StockStackHost stack={stack} />
    </>
  );
}

/** Type `query` into the picker `testId` and ask for the full record. */
async function askFull(user: ReturnType<typeof setup>, testId: string, query: string) {
  await user.click(screen.getAllByTestId(testId)[0] as HTMLElement);
  await user.type(await screen.findByRole('combobox'), query);
  await user.click(await screen.findByTestId(`${testId}-create-full`));
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockStackHost (clinic-stock.md:174–201, 275–287)', () => {
  it('stacks New clinic vendor named from the picker; Esc closes the child first', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderStockDrawer(<Host onClose={onClose} />);
    await screen.findByTestId(D);
    await askFull(user, `${D}-vendor`, 'Ankit');

    const child = await screen.findByTestId(VENDOR);
    expect(within(child).getByTestId(`${VENDOR}-title`)).toHaveTextContent(
      'New clinic vendor',
    );
    expect(within(child).getByTestId(`${VENDOR}-name`)).toHaveValue('Ankit');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId(VENDOR)).not.toBeInTheDocument());
    expect(screen.getByTestId(D)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the new vendor’s save picks it as the supplier', async () => {
    const user = setup();
    renderStockDrawer(<Host onClose={vi.fn()} />);
    const parent = await screen.findByTestId(D);
    await askFull(user, `${D}-vendor`, 'Ankit Traders');
    const child = await screen.findByTestId(VENDOR);
    await user.click(within(child).getByTestId(`${VENDOR}-save`));
    await waitFor(() => expect(screen.queryByTestId(VENDOR)).not.toBeInTheDocument());
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor Ankit Traders added');
    await waitFor(() =>
      expect(within(parent).getByTestId(`${D}-badges`)).toHaveTextContent(
        'Ankit Traders',
      ),
    );
  });

  it('a line’s "New clinic item" stacks the item, from the purchase’s vendor, and fills the line', async () => {
    const user = setup();
    renderStockDrawer(<Host onClose={vi.fn()} />);
    const parent = await screen.findByTestId(D);
    await user.click(within(parent).getByTestId(`${D}-step-items-trigger`));
    await user.click(within(parent).getByTestId(`${D}-lines-add`));
    await askFull(user, `${D}-lines-item`, 'Cotton');

    const child = await screen.findByTestId(ITEM);
    expect(within(child).getByTestId(`${ITEM}-name`)).toHaveValue('Cotton');
    await user.click(within(child).getByTestId(`${ITEM}-save`));
    await waitFor(() => expect(screen.queryByTestId(ITEM)).not.toBeInTheDocument());
    expect(
      clinicFixtures.stockItems.snapshot((row) => row.name === 'Cotton'),
    ).toHaveLength(1);
    await waitFor(() =>
      expect(within(parent).getByTestId(`${D}-lines-item`)).toHaveTextContent('Cotton'),
    );
  });
});
