import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { fetchStockItem } from '../../stock-api.ts';
import type { StockItemRow } from '../../stock-contracts.ts';
import { StockUsePopover } from './StockUsePopover.tsx';

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

const P = 'stock-use-popover';
const SOFRAMYCIN = ref.stockItem(167);
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const qtyOf = (id: string) =>
  clinicFixtures.stockItems.snapshot((item) => item.id === id)[0]?.qtyMilli;

/** The rows' Use buttons the popovers anchored to, removed after each test. */
const anchors: HTMLButtonElement[] = [];

/** The row's Use button the popover anchors to. */
function anchorButton() {
  const button = document.createElement('button');
  button.textContent = 'Use';
  document.body.append(button);
  anchors.push(button);
  return button;
}

/** Open the popover for `item` (Soframycin, 3 tubes of 30 g, by default). */
async function openFor(item?: StockItemRow) {
  const onClose = vi.fn();
  const onMoreDetails = vi.fn();
  const row = item ?? (await fetchStockItem(SOFRAMYCIN));
  renderStockDrawer(
    <StockUsePopover
      item={row}
      anchor={anchorButton()}
      onClose={onClose}
      onMoreDetails={onMoreDetails}
    />,
  );
  return { popover: await screen.findByTestId(P), onClose, onMoreDetails, row };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetStockRoutes();
  resetClinicFixtures();
  for (const anchor of anchors.splice(0)) anchor.remove();
});

describe('StockUsePopover (clinic-stock.md:89–103, 205–217)', () => {
  it('opens on one unit, focused, and uses it — with Undo', async () => {
    const user = setup();
    const { popover, onClose } = await openFor();
    expect(popover).toHaveAccessibleName('Use Soframycin 30 gm');
    expect(popover).toHaveTextContent('In stock · 3 tube · 90 g');
    const quantity = within(popover).getByTestId(`${P}-quantity`);
    expect(quantity).toHaveValue('1');
    await waitFor(() => expect(quantity).toHaveFocus());
    expect(within(popover).getByTestId(`${P}-after`)).toHaveTextContent(
      'After · 2 tube · 60 g',
    );
    expect(within(popover).getByTestId(`${P}-mode`)).toHaveTextContent('tubeg');
    expect(popover).toHaveTextContent('1 tube = 30 g');
    expect(await axeForDialog(popover)).toHaveNoViolations();

    await user.click(within(popover).getByTestId(`${P}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(qtyOf(SOFRAMYCIN)).toBe(2000);
    expect(notifyMock.undo).toHaveBeenCalledWith(
      '1 tube of Soframycin 30 gm used · 2 tube left',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(() => expect(qtyOf(SOFRAMYCIN)).toBe(3000));
  });

  it('steps half a tube, picks a quick chip, and stops at what is in stock', async () => {
    const user = setup();
    const { popover } = await openFor();
    const quantity = within(popover).getByTestId(`${P}-quantity`);
    await user.click(within(popover).getByTestId(`${P}-more`));
    expect(quantity).toHaveValue('1.5');
    await user.click(within(popover).getByTestId(`${P}-less`));
    await user.click(within(popover).getByTestId(`${P}-less`));
    expect(quantity).toHaveValue('0.5');
    await user.click(within(popover).getByTestId(`${P}-quick-2`));
    expect(within(popover).getByTestId(`${P}-quick-2`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(popover).getByTestId(`${P}-save`)).toHaveTextContent('Use 2 tube');

    await user.clear(quantity);
    await user.type(quantity, '4');
    expect(within(popover).getByRole('alert')).toHaveTextContent(
      'Only 3 tube · 90 g in stock',
    );
    expect(within(popover).getByTestId(`${P}-save`)).toBeDisabled();

    await user.clear(quantity);
    expect(within(popover).getByTestId(`${P}-save`)).toHaveTextContent(
      'Enter a quantity',
    );
    expect(within(popover).getByTestId(`${P}-save`)).toBeDisabled();
  });

  it('counts in grams, notes it with what it was for, and Enter saves', async () => {
    const user = setup();
    const { popover, onClose } = await openFor();
    await user.click(within(popover).getByRole('radio', { name: 'g' }));
    const quantity = within(popover).getByTestId(`${P}-quantity`);
    expect(quantity).toHaveValue('10');
    // 1 · 5 · 10 · 25 — up to the 30 g contents; the measure steps 5.
    expect(within(popover).queryByTestId(`${P}-quick-50`)).not.toBeInTheDocument();
    await user.click(within(popover).getByTestId(`${P}-more`));
    expect(quantity).toHaveValue('15');
    await user.click(within(popover).getByTestId(`${P}-used-for-Peel`));

    await user.type(quantity, '{Enter}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(qtyOf(SOFRAMYCIN)).toBe(2500);
    expect(
      clinicFixtures.stockMovements
        .snapshot((movement) => movement.itemId === SOFRAMYCIN)
        .at(-1),
    ).toMatchObject({ type: 'used', usedFor: 'Peel · 15 g' });
  });

  it('"More details" hands the item to the Log usage drawer', async () => {
    const user = setup();
    const { popover, onMoreDetails, row } = await openFor();
    await user.click(within(popover).getByTestId(`${P}-more-details`));
    expect(onMoreDetails).toHaveBeenCalledWith(row);
  });

  it('an item without contents counts in units only', async () => {
    const item = await fetchStockItem(SOFRAMYCIN);
    const { popover } = await openFor({ ...item, sizePerUnit: null, measureUnit: null });
    expect(within(popover).queryByTestId(`${P}-mode`)).not.toBeInTheDocument();
    expect(popover).toHaveTextContent('In stock · 3 tube');
  });

  it('stays closed without an item or an anchor', () => {
    renderStockDrawer(
      <StockUsePopover
        item={null}
        anchor={null}
        onClose={vi.fn()}
        onMoreDetails={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(P)).not.toBeInTheDocument();
  });
});
