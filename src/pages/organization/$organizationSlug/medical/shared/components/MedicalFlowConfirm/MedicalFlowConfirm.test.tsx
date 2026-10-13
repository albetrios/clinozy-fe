import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { MedicalFlowConfirm, type MedicalFlowTarget } from './MedicalFlowConfirm.tsx';

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

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

/** Open the confirm on `target` and confirm with `reason`; resolve once its write is done. */
async function confirm(
  target: MedicalFlowTarget,
  title: string,
  reason: string,
  action: string,
) {
  const user = setup();
  const onDone = vi.fn();
  renderMedicalDrawer(
    <MedicalFlowConfirm target={target} onClose={vi.fn()} onDone={onDone} />,
  );
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(title)).toBeInTheDocument();
  expect(dialog).toHaveTextContent(target.record);
  await user.click(within(dialog).getByRole('radio', { name: reason }));
  await user.click(within(dialog).getByRole('button', { name: action }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
}

/** Press the Undo of the toast the confirm raised — the one `notify.undo` was handed. */
function pressUndo(message: string) {
  expect(notifyMock.undo).toHaveBeenCalledTimes(1);
  expect(notifyMock.undo).toHaveBeenCalledWith(message, {
    onUndo: expect.any(Function),
  });
  const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
  options.onUndo();
}

/** A medicine's batch quantity, by the medicine's number and the batch. */
async function batchQty(medicineSeq: number, batchNo: string) {
  const medicine = await appFixtures.medicines.get(ref.medicine(medicineSeq));
  return medicine.batches.find((batch) => batch.batchNo === batchNo)?.qty;
}

describe('MedicalFlowConfirm (medical.md:357–368)', () => {
  it('cancels an Ordered purchase order with its reason, and Undo puts it back', async () => {
    const id = ref.purchaseOrder(430);
    await confirm(
      { kind: 'cancelOrder', id, seq: 430, record: '₹4,236' },
      'Cancel this purchase order?',
      'Ordered by mistake',
      'Cancel order',
    );
    expect(await appFixtures.purchaseOrders.get(id)).toMatchObject({
      stage: 'cancelled',
      cancelReason: 'mistake',
    });
    // One answer: "PO #430 cancelled" with Undo — no plain success beside it.
    expect(notifyMock.success).not.toHaveBeenCalled();
    pressUndo('PO #430 cancelled');
    await waitFor(async () =>
      expect(await appFixtures.purchaseOrders.get(id)).toMatchObject({
        stage: 'ordered',
        cancelReason: null,
      }),
    );
  });

  it('voids an unpaid sale, and Undo brings it back — its invoice and its stock', async () => {
    const id = ref.medicalSale(978);
    const before = await batchQty(453, 'ADE25510');
    await confirm(
      { kind: 'voidSale', id, seq: 978, record: 'Dharti Galani' },
      'Void this sale?',
      'Billed by mistake',
      'Void sale',
    );
    expect((await appFixtures.medicalSales.get(id)).voidedAt).not.toBeNull();
    expect(await batchQty(453, 'ADE25510')).toBeGreaterThan(before ?? 0);
    expect(notifyMock.success).not.toHaveBeenCalled();
    pressUndo('Sale #978 voided');
    await waitFor(async () =>
      expect((await appFixtures.medicalSales.get(id)).voidedAt).toBeNull(),
    );
    expect(await batchQty(453, 'ADE25510')).toBe(before);
    expect(
      appFixtures.invoices.snapshot((invoice) => invoice.id === ref.invoice(788)),
    ).toHaveLength(1);
  });

  it('stays closed without a target', () => {
    renderMedicalDrawer(<MedicalFlowConfirm target={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
