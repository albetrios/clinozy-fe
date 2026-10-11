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
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchPurchaseOrder } from '../../../shared/medical-api.ts';
import {
  emptyUnexpectedLine,
  expiryProblems,
  receiveInputOf,
  type ReceiveLineValues,
  receiveTotal,
  unexpectedProblems,
} from './receive-form.ts';
import { ReceiveGoodsDrawer } from './ReceiveGoodsDrawer.tsx';

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

const D = 'receive-goods-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

/** An ordered line of #430 — Epriva Tab, 10 + 2 free at ₹212. */
const ORDERED: ReceiveLineValues = {
  medicineId: ref.medicine(455),
  name: 'Epriva Tab',
  qty: 10,
  free: 2,
  rate: 21_200,
  arrived: true,
  batchNo: ' ',
  expiry: '',
  unexpected: false,
};

/** An unexpected line with Azelan picked: 2 at ₹190, batch AZ900. */
const AZELAN: ReceiveLineValues = {
  ...emptyUnexpectedLine(),
  medicineId: ref.medicine(450),
  name: 'Azelan 20% Cream',
  qty: 2,
  rate: 19_000,
  batchNo: 'AZ900',
  expiry: '06/28',
};

describe('receive-form (medical.md:269–279)', () => {
  it('needs an arrived line’s expiry as "MM/YY"; a line that did not arrive sends nothing', () => {
    const line = ORDERED;
    expect(
      expiryProblems([
        { ...line, arrived: true },
        { ...line, arrived: true, expiry: '13/27' },
        { ...line, arrived: true, expiry: '12/27' },
        { ...line, arrived: false },
      ]),
    ).toEqual([
      { index: 0, problem: 'missing' },
      { index: 1, problem: 'invalid' },
    ]);
    expect(
      receiveInputOf({
        lines: [
          { ...line, arrived: true, expiry: '12/27' },
          { ...line, arrived: false, expiry: '12/27' },
        ],
      }),
    ).toEqual({
      lines: [
        { arrived: true, batchNo: null, expiry: '12/27' },
        { arrived: false, batchNo: null, expiry: null },
      ],
      extras: [],
    });
  });

  it('sends an unexpected line once its medicine is picked; a blank one is left out (H:5388)', () => {
    const blank = emptyUnexpectedLine();
    expect(blank).toMatchObject({
      medicineId: null,
      qty: 1,
      arrived: true,
      unexpected: true,
    });
    const lines = [{ ...ORDERED, expiry: '12/27' }, AZELAN, blank];
    expect(receiveInputOf({ lines })).toEqual({
      lines: [{ arrived: true, batchNo: null, expiry: '12/27' }],
      extras: [
        {
          medicineId: ref.medicine(450),
          qty: 2,
          free: 0,
          rate: 19_000,
          batchNo: 'AZ900',
          expiry: '06/28',
        },
      ],
    });
    // The blank line asks for nothing; a picked one is checked like an ordered one.
    expect(expiryProblems([blank, { ...AZELAN, expiry: '' }])).toEqual([
      { index: 1, problem: 'missing' },
    ]);
    // Ticked ✗, an unexpected line is not sent either.
    expect(receiveInputOf({ lines: [{ ...AZELAN, arrived: false }] }).extras).toEqual([]);
  });

  it('names an unexpected line with no count or no rate, and bills what comes in', () => {
    const lines = [
      { ...ORDERED, expiry: '12/27' },
      { ...AZELAN, qty: 0 },
      { ...AZELAN, rate: 0 },
      emptyUnexpectedLine(),
    ];
    expect(unexpectedProblems(lines)).toEqual({ qty: [1], rate: [2] });
    // #430's ₹4,236 and 2 × ₹190; free units cost nothing, a blank line nothing.
    expect(receiveTotal({ total: 423_600 }, [ORDERED, { ...AZELAN, free: 3 }])).toBe(
      423_600 + 38_000,
    );
    expect(receiveTotal({ total: 423_600 }, [{ ...AZELAN, arrived: false }])).toBe(
      423_600,
    );
  });
});

describe('ReceiveGoodsDrawer (medical.md:269–279)', () => {
  it('ticks every line, needs each arrived expiry, and marks the order received', async () => {
    const user = setup();
    const onClose = vi.fn();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={order} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent(
      `${fsi('K R Medical Agency')} · tick each item and enter batch & expiry`,
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,236');
    // The chip row (H:5394): the supplier in sky, the lines and their bill.
    const badges = within(drawer).getByTestId(`${D}-badges`);
    expect([...badges.children].map((badge) => badge.textContent)).toEqual([
      'K R Medical Agency',
      '2 items',
      '₹4,236',
    ]);
    // The section's heading shows (H:5388), and names the table's group.
    expect(
      within(drawer).getByRole('group', { name: 'Tick what arrived' }),
    ).toBeInTheDocument();
    // A long sub wraps to a second line on a phone instead of being cut.
    expect(
      within(drawer).getByText(
        `${fsi('K R Medical Agency')} · tick each item and enter batch & expiry`,
      ),
    ).toHaveClass('max-md:line-clamp-2', 'max-md:whitespace-normal');
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    // Nothing typed: each arrived line's expiry is asked for.
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter the expiry');

    // The second line did not come; the first came without a batch number.
    const [first, second] = within(drawer).getAllByTestId(`${D}-lines-arrived`);
    if (!(first && second)) throw new Error('expected two lines');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'false');
    expect(second).toHaveAccessibleName('Not arrived');
    const [expiry] = within(drawer).getAllByTestId(`${D}-lines-expiry`);
    if (!expiry) throw new Error('expected an expiry cell');
    await user.type(expiry, '12/27');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Goods received · stock and free quantity added',
    );
    const saved = await appFixtures.purchaseOrders.get(ref.purchaseOrder(430));
    expect(saved.stage).toBe('received');
    expect(saved.items.map((item) => [item.received, item.batchNo])).toEqual([
      [true, 'NEW-430'],
      [false, null],
    ]);
  });

  it('asks for something that arrived, and names an expiry not "MM/YY"', async () => {
    const user = setup();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={order} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    const [expiry] = within(drawer).getAllByTestId(`${D}-lines-expiry`);
    if (!expiry) throw new Error('expected an expiry cell');
    await user.type(expiry, '1227');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter the expiry as MM/YY');

    for (const toggle of within(drawer).getAllByTestId(`${D}-lines-arrived`)) {
      await user.click(toggle);
    }
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Tick what arrived');
  });

  it('adds an unexpected item — medicine, count, rate, batch, expiry — into stock and onto the bill', async () => {
    const user = setup();
    const onClose = vi.fn();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    renderMedicalDrawer(
      <ReceiveGoodsDrawer open order={order} onClose={onClose} openChild={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    const table = within(drawer).getByTestId(`${D}-lines-table`);
    // The design's columns until an unexpected line comes: no Rate, no ×.
    expect(within(table).queryByRole('columnheader', { name: 'Rate' })).toBeNull();
    expect(within(drawer).queryByTestId(`${D}-lines-remove`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-lines-add`));
    expect(within(drawer).getByTestId(`${D}-lines-add`)).toHaveTextContent(
      'Add unexpected item',
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(3);
    expect(within(table).getByRole('columnheader', { name: 'Rate' })).toBeInTheDocument();
    expect(within(drawer).getAllByTestId(`${D}-lines-remove`)).toHaveLength(1);

    // Azelan from K R Medical Agency's price list: its ₹190 fills the rate.
    await user.click(within(drawer).getByTestId(`${D}-lines-medicine`));
    await user.click(
      await screen.findByTestId(`${D}-lines-medicine-option-${ref.medicine(450)}`),
    );
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,426');
    const qty = within(drawer).getByTestId(`${D}-lines-qty`);
    await user.clear(qty);
    await user.type(qty, '2');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,616');
    // The chips follow the lines, the unexpected one included.
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(
      'K R Medical Agency3 items₹4,616',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    // Nothing on the order came; Azelan did, in batch AZ900.
    const [first, second] = within(drawer).getAllByTestId(`${D}-lines-arrived`);
    if (!(first && second)) throw new Error('expected the ordered lines');
    await user.click(first);
    await user.click(second);
    const batches = within(drawer).getAllByTestId(`${D}-lines-batch`);
    const expiries = within(drawer).getAllByTestId(`${D}-lines-expiry`);
    await user.type(batches[2] as HTMLElement, 'AZ900');
    await user.type(expiries[2] as HTMLElement, '06/28');

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await appFixtures.purchaseOrders.get(ref.purchaseOrder(430));
    expect(saved.stage).toBe('received');
    expect(saved.items[2]).toEqual({
      medicineId: ref.medicine(450),
      qty: 2,
      free: 0,
      rate: 19_000,
      batchNo: 'AZ900',
      expiry: '06/28',
      received: true,
    });
    const azelan = await appFixtures.medicines.get(ref.medicine(450));
    expect(azelan.batches.find((batch) => batch.batchNo === 'AZ900')?.qty).toBe(2);
  });

  it('asks for an unexpected line’s count and rate, and drops it with its ×', async () => {
    const user = setup();
    const onClose = vi.fn();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={order} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-lines-add`));
    await user.click(within(drawer).getByTestId(`${D}-lines-medicine`));
    await user.click(
      await screen.findByTestId(`${D}-lines-medicine-option-${ref.medicine(450)}`),
    );
    for (const expiry of within(drawer).getAllByTestId(`${D}-lines-expiry`)) {
      await user.type(expiry, '12/27');
    }

    await user.clear(within(drawer).getByTestId(`${D}-lines-qty`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a quantity');

    await user.type(within(drawer).getByTestId(`${D}-lines-qty`), '1');
    await user.clear(within(drawer).getByTestId(`${D}-lines-rate`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'Enter the rate for Azelan 20% Cream',
    );
    expect(onClose).not.toHaveBeenCalled();

    // × drops the line, and the Rate column with it.
    await user.click(within(drawer).getByTestId(`${D}-lines-remove`));
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(
      within(within(drawer).getByTestId(`${D}-lines-table`)).queryByRole('columnheader', {
        name: 'Rate',
      }),
    ).toBeNull();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await appFixtures.purchaseOrders.get(ref.purchaseOrder(430));
    expect(saved.items).toHaveLength(2);
  });

  it('names an unexpected line’s figures on a phone, where the header row is gone', async () => {
    viewport.tier = 'phone';
    const user = setup();
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={order} onClose={vi.fn()} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-lines-add`));
    const [, , added] = within(drawer).getAllByTestId(`${D}-lines-row`);
    const row = within(added as HTMLElement);
    for (const name of ['Qty', 'Free', 'Rate']) {
      // A visible caption, and the same name on the field itself.
      expect(row.getByText(name)).toBeVisible();
      expect(row.getByRole('textbox', { name })).toBeInTheDocument();
    }
    expect(row.getByRole('textbox', { name: 'Qty' })).toHaveClass('max-md:w-14');
    // The ordered lines keep the design's bare figures.
    const [ordered] = within(drawer).getAllByTestId(`${D}-lines-row`);
    expect(within(ordered as HTMLElement).queryByText('Qty')).toBeNull();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    viewport.tier = 'desktop';
  });

  it('shimmers until the order is read', async () => {
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={undefined} onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
