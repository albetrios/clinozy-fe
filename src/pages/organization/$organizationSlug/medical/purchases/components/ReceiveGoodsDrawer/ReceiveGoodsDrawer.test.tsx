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
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchPurchaseOrder } from '../../../shared/medical-api.ts';
import { expiryProblems, receiveInputOf } from './receive-form.ts';
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
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('receive-form (medical.md:269–279)', () => {
  it('needs an arrived line’s expiry as "MM/YY"; a line that did not arrive sends nothing', () => {
    const line = { name: 'Epriva Tab', qty: 10, free: 2, batchNo: ' ', expiry: '' };
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
    });
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
      'K R Medical Agency · tick each item and enter batch & expiry',
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent('₹4,236');
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
    const saved = await clinicFixtures.purchaseOrders.get(ref.purchaseOrder(430));
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

  it('shimmers until the order is read', async () => {
    renderMedicalDrawer(<ReceiveGoodsDrawer open order={undefined} onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
