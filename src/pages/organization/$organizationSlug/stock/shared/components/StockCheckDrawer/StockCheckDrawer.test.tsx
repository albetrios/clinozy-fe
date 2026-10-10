import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllStockItems: vi.fn(),
}));
vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveStockCount: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { stockItemRow, TEST_STOCK_ITEM_ID } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchAllStockItems } from '../../stock-api.ts';
import type { StockItemRow } from '../../stock-contracts.ts';
import { saveStockCount } from '../../stock-records-api.ts';
import { StockCheckDrawer } from './StockCheckDrawer.tsx';

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

const D = 'stock-check-drawer';
const GAUZE_ID = 'sitm_gauze000000000000000';
const RICHCLIN_ID = 'sitm_richclin00000000000';
const FUCIBET_ID = 'sitm_fucibet00000000000';
const MASK_ID = 'sitm_mask000000000000000';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The whole item list, latest first: three creams, gauze and a mask. */
const ITEMS: StockItemRow[] = [
  stockItemRow(),
  stockItemRow({ id: RICHCLIN_ID, seq: 166, name: 'Richclin gel', qtyMilli: 2000 }),
  stockItemRow({
    id: FUCIBET_ID,
    seq: 165,
    name: 'Fucibet cream',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 1000,
  }),
  stockItemRow({
    id: GAUZE_ID,
    seq: 158,
    name: 'Gauze swabs',
    category: 'consumables',
    unit: 'pack',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 14_000,
  }),
  stockItemRow({
    id: MASK_ID,
    seq: 161,
    name: 'D-Tan Mask',
    category: 'masks',
    unit: 'pack',
    sizePerUnit: null,
    measureUnit: null,
    qtyMilli: 0,
    level: 'out',
  }),
];

const rows = () => screen.getAllByTestId(`${D}-row`);
const rowOf = (name: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no count row for ${name}`);
  return row;
};

/** Open Stock check once its items are listed. */
async function openCheck() {
  const onClose = vi.fn();
  renderStockDrawer(<StockCheckDrawer open onClose={onClose} />);
  await waitFor(() => expect(rows()).toHaveLength(ITEMS.length));
  return { drawer: screen.getByTestId(D), onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  viewport.tier = 'desktop';
  vi.mocked(fetchAllStockItems).mockResolvedValue(ITEMS);
});
afterEach(() => resetStockRoutes());

describe('StockCheckDrawer (clinic-stock.md:73–85, 159–172, 261–273)', () => {
  it('lists every item in inventory order, nothing counted, nothing to save', async () => {
    const { drawer } = await openCheck();
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Stock check');
    expect(drawer).toHaveTextContent(
      'Type what is on the shelf. Only items that differ are saved, each as an Adjust entry.',
    );
    expect(within(drawer).getByTestId(`${D}-counter`)).toHaveTextContent(
      '0 of 5 counted',
    );
    expect(rows()[0]).toHaveTextContent('Soframycin 30 gm');
    expect(within(rowOf('Soframycin')).getByTestId(`${D}-count`)).toHaveAttribute(
      'placeholder',
      '3',
    );
    expect(within(rowOf('Soframycin')).getByTestId(`${D}-difference`)).toHaveTextContent(
      'Not counted',
    );
    // A phone reads "In system · …" on each card.
    expect(rowOf('Soframycin')).toHaveTextContent('In system · 3 tube · 90 g');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Nothing changes yet',
    );
    expect(within(drawer).getByTestId(`${D}-save`)).toBeDisabled();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('shows each difference live; ✓ copies the system figure; saves only what differs', async () => {
    const user = setup();
    vi.mocked(saveStockCount).mockResolvedValue({
      id: 'scnt_count0000000000000',
      changed: 2,
    });
    const { drawer, onClose } = await openCheck();
    const soframycin = rowOf('Soframycin');
    await user.type(within(soframycin).getByTestId(`${D}-count`), '2.5');
    expect(soframycin).toHaveTextContent('= 75 g');
    expect(within(soframycin).getByTestId(`${D}-difference`)).toHaveTextContent(
      '−0.5 tube',
    );
    await user.click(within(rowOf('Richclin')).getByTestId(`${D}-same`));
    expect(within(rowOf('Richclin')).getByTestId(`${D}-difference`)).toHaveTextContent(
      'Matches',
    );
    await user.type(within(rowOf('Gauze')).getByTestId(`${D}-count`), '15');
    expect(within(rowOf('Gauze')).getByTestId(`${D}-difference`)).toHaveTextContent(
      '+1 pack',
    );
    expect(within(drawer).getByTestId(`${D}-counter`)).toHaveTextContent(
      '3 of 5 counted',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      '2 items will change',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The matching Richclin is not sent; the API answers how many it changed.
    expect(saveStockCount).toHaveBeenCalledWith({
      input: {
        lines: [
          { itemId: TEST_STOCK_ITEM_ID, countedMilli: 2500 },
          { itemId: GAUZE_ID, countedMilli: 15_000 },
        ],
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Stock check saved · 2 items updated',
    );
  });

  it('a category chip narrows the list; "Fill rest as matching" counts what is left of it', async () => {
    const user = setup();
    const { drawer } = await openCheck();
    await user.click(within(drawer).getByTestId(`${D}-category-masks`));
    expect(rows()).toHaveLength(1);
    await user.click(within(drawer).getByTestId(`${D}-category-creams_serums`));
    expect(rows()).toHaveLength(3);
    await user.type(within(rowOf('Fucibet')).getByTestId(`${D}-count`), '3');
    await user.click(within(drawer).getByTestId(`${D}-fill-rest`));
    for (const row of rows()) {
      expect(within(row).getByTestId(`${D}-count`)).not.toHaveValue('');
    }
    expect(within(rowOf('Fucibet')).getByTestId(`${D}-count`)).toHaveValue('3');
    expect(within(drawer).getByTestId(`${D}-counter`)).toHaveTextContent(
      '3 of 5 counted',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      '1 item will change',
    );
    await user.click(within(drawer).getByTestId(`${D}-category-all`));
    expect(rows()).toHaveLength(5);
  });

  it('a failed save keeps the counts and says so; "Retry save" saves them', async () => {
    const user = setup();
    vi.mocked(saveStockCount)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ id: 'scnt_count0000000000000', changed: 1 });
    const { drawer, onClose } = await openCheck();
    await user.type(within(rowOf('Soframycin')).getByTestId(`${D}-count`), '2');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Retry save'),
    );
    expect(drawer).toHaveTextContent('Not saved · your counts are kept');
    expect(within(rowOf('Soframycin')).getByTestId(`${D}-count`)).toHaveValue('2');
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveStockCount).toHaveBeenCalledTimes(2);
    expect(notifyMock.success).toHaveBeenCalledWith('Stock check saved · 1 item updated');
  });

  it('a failed read offers Retry in place, which reads the items again', async () => {
    const user = setup();
    vi.mocked(fetchAllStockItems)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ITEMS);
    renderStockDrawer(<StockCheckDrawer open onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    await user.click(await within(drawer).findByTestId('retry-button'));
    await waitFor(() => expect(rows()).toHaveLength(ITEMS.length));
    expect(within(drawer).queryByTestId('retry-error')).not.toBeInTheDocument();
  });

  it('a clinic with no items yet has nothing to count', async () => {
    vi.mocked(fetchAllStockItems).mockResolvedValue([]);
    renderStockDrawer(<StockCheckDrawer open onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    expect(await within(drawer).findByTestId(`${D}-empty`)).toBeInTheDocument();
    expect(within(drawer).queryAllByTestId(`${D}-row`)).toHaveLength(0);
    expect(within(drawer).getByTestId(`${D}-save`)).toBeDisabled();
  });
});
