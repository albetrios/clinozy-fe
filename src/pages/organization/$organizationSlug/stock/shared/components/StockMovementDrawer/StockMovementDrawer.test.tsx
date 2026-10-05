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
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchStockItem } from '../../stock-api.ts';
import type { StockItemRow } from '../../stock-contracts.ts';
import type { StockMovementInputType } from '../../stock-records-contracts.ts';
import { StockMovementDrawer } from './StockMovementDrawer.tsx';

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

const D = 'stock-movement-drawer';
const SOFRAMYCIN = ref.stockItem(167);
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const qtyOf = (id: string) =>
  clinicFixtures.stockItems.snapshot((item) => item.id === id)[0]?.qtyMilli;
const lastMovementOf = (id: string) =>
  clinicFixtures.stockMovements.snapshot((movement) => movement.itemId === id).at(-1);

/** Open the drawer for `item` as the row action `type` would. */
async function openFor(type: StockMovementInputType, item?: StockItemRow) {
  const onClose = vi.fn();
  const row = item ?? (await fetchStockItem(SOFRAMYCIN));
  renderStockDrawer(
    <StockMovementDrawer item={row} type={type} open onClose={onClose} />,
  );
  return { drawer: await screen.findByTestId(D), onClose };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockMovementDrawer (clinic-stock.md:126–140, 233–245)', () => {
  it('Receive stock: the item now, the stock after it, and a save with Undo', async () => {
    const user = setup();
    const { drawer, onClose } = await openFor('received');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Receive stock');
    expect(drawer).toHaveTextContent(
      `${fsi('Soframycin 30 gm')} · ${fsi('3 tube · 90 g')} now`,
    );
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'ReceivedAfter: 4 tube · 120 g',
    );
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('1');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-quick-2`));
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'After: 5 tube · 150 g',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(qtyOf(SOFRAMYCIN)).toBe(5000);
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Received saved · 5 tube left',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(() => expect(qtyOf(SOFRAMYCIN)).toBe(3000));
  });

  it('Log usage refuses no quantity and more than the shelf holds', async () => {
    const user = setup();
    const { drawer, onClose } = await openFor('used');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Log usage');
    const quantity = within(drawer).getByTestId(`${D}-quantity`);

    await user.clear(quantity);
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter a quantity');

    await user.type(quantity, '4');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Soframycin 30 gm · −4 tube',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Only 3 tube · 90 g in stock');
    expect(onClose).not.toHaveBeenCalled();
    expect(qtyOf(SOFRAMYCIN)).toBe(3000);
  });

  it('Adjust starts from the shelf as the counted quantity, ± in the summary', async () => {
    const user = setup();
    const { drawer, onClose } = await openFor('adjust');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Adjust stock');
    expect(drawer).toHaveTextContent('Counted quantity');
    const quantity = within(drawer).getByTestId(`${D}-quantity`);
    expect(quantity).toHaveValue('3');

    await user.clear(quantity);
    await user.type(quantity, '0.5');
    // At or below the minimum, the After pill turns butter.
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'After: 0.5 tube · 15 g',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Soframycin 30 gm · ±0.5 tube',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastMovementOf(SOFRAMYCIN)).toMatchObject({
      type: 'adjust',
      deltaMilli: -2500,
    });
  });

  it('switching the type retitles the drawer and starts its quantity again', async () => {
    const user = setup();
    const { drawer } = await openFor('used');
    await user.click(within(drawer).getByTestId(`${D}-type-adjust`));
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Adjust stock');
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('3');
    await user.click(within(drawer).getByTestId(`${D}-type-received`));
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Receive stock');
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('1');
  });

  it('counts in the measure, notes it, what it was used for and the remark', async () => {
    const user = setup();
    const { drawer, onClose } = await openFor('used');
    await user.click(within(drawer).getByTestId(`${D}-mode-measure`));
    expect(within(drawer).getByTestId(`${D}-quantity`)).toHaveValue('10');
    // 1 · 5 · 10 · 25 up to the 30 g contents.
    expect(within(drawer).queryByTestId(`${D}-quick-50`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-quick-25`));
    expect(within(drawer).getByTestId(`${D}-mode-measure`)).toHaveTextContent(
      'g (1 tube = 30 g)',
    );

    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-used-for-LHR`));
    await user.click(within(drawer).getByTestId(`${D}-step-notes-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-note`), 'Dharti Galani');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastMovementOf(SOFRAMYCIN)).toMatchObject({
      type: 'used',
      deltaMilli: -833,
      usedFor: 'LHR · 25 g · Dharti Galani',
    });
  });

  it('renders nothing without an item', () => {
    renderStockDrawer(
      <StockMovementDrawer item={null} type="used" open onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
  });
});
