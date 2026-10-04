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
import type * as RecordsApi from '../../stock-records-api.ts';
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

/** Saves that fail before they reach the world — a dropped connection. */
const failures = vi.hoisted(() => ({ left: 0 }));
vi.mock('../../stock-records-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof RecordsApi>();
  return {
    ...actual,
    saveStockCount: async (...args: Parameters<typeof actual.saveStockCount>) => {
      if (failures.left > 0) {
        failures.left -= 1;
        throw new TypeError('Failed to fetch');
      }
      return actual.saveStockCount(...args);
    },
  };
});

const D = 'stock-check-drawer';
const SOFRAMYCIN = ref.stockItem(167);
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const rows = () => screen.getAllByTestId(`${D}-row`);
const rowOf = (name: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no count row for ${name}`);
  return row;
};
const qtyOf = (id: string) =>
  clinicFixtures.stockItems.snapshot((item) => item.id === id)[0]?.qtyMilli;

/** Open Stock check once its ten items are listed. */
async function openCheck() {
  const onClose = vi.fn();
  renderStockDrawer(<StockCheckDrawer open onClose={onClose} />);
  await waitFor(() => expect(rows()).toHaveLength(10));
  return { drawer: screen.getByTestId(D), onClose };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  failures.left = 0;
  viewport.tier = 'desktop';
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
});

describe('StockCheckDrawer (clinic-stock.md:73–85, 159–172, 261–273)', () => {
  it('lists every item in inventory order, nothing counted, nothing to save', async () => {
    const { drawer } = await openCheck();
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Stock check');
    expect(drawer).toHaveTextContent(
      'Type what is on the shelf. Only items that differ are saved, each as an Adjust entry.',
    );
    expect(within(drawer).getByTestId(`${D}-counter`)).toHaveTextContent(
      '0 of 10 counted',
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

  it('shows each difference live; ✓ copies the system figure; saves what differs', async () => {
    const user = setup();
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
      '3 of 10 counted',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      '2 items will change',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Stock check saved · 2 items updated',
    );
    expect(qtyOf(SOFRAMYCIN)).toBe(2500);
    expect(qtyOf(ref.stockItem(158))).toBe(15_000);
  });

  it('a category chip narrows the list; "Fill rest as matching" counts what is left of it', async () => {
    const user = setup();
    const { drawer } = await openCheck();
    await user.click(within(drawer).getByTestId(`${D}-category-masks`));
    expect(rows()).toHaveLength(1);
    await user.click(within(drawer).getByTestId(`${D}-category-creams_serums`));
    expect(rows()).toHaveLength(4);
    await user.type(within(rowOf('Fucibet')).getByTestId(`${D}-count`), '3');
    await user.click(within(drawer).getByTestId(`${D}-fill-rest`));
    for (const row of rows()) {
      expect(within(row).getByTestId(`${D}-count`)).not.toHaveValue('');
    }
    expect(within(rowOf('Fucibet')).getByTestId(`${D}-count`)).toHaveValue('3');
    expect(within(drawer).getByTestId(`${D}-counter`)).toHaveTextContent(
      '4 of 10 counted',
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      '1 item will change',
    );
    await user.click(within(drawer).getByTestId(`${D}-category-all`));
    expect(rows()).toHaveLength(10);
  });

  it('a failed save keeps the counts and says so; "Retry save" saves them', async () => {
    const user = setup();
    failures.left = 1;
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
    expect(qtyOf(SOFRAMYCIN)).toBe(2000);
  });
});
