import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
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
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
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

describe('MedicalFlowConfirm (medical.md:357–368)', () => {
  it('cancels an Ordered purchase order with its reason: "PO #430 cancelled"', async () => {
    const id = ref.purchaseOrder(430);
    await confirm(
      { kind: 'cancelOrder', id, record: '₹4,236' },
      'Cancel this purchase order?',
      'Ordered by mistake',
      'Cancel order',
    );
    expect(await clinicFixtures.purchaseOrders.get(id)).toMatchObject({
      stage: 'cancelled',
      cancelReason: 'mistake',
    });
    expect(notifyMock.success).toHaveBeenCalledWith('PO #430 cancelled');
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('voids an unpaid sale: "Sale #978 voided"', async () => {
    const id = ref.medicalSale(978);
    await confirm(
      { kind: 'voidSale', id, record: 'Dharti Galani' },
      'Void this sale?',
      'Billed by mistake',
      'Void sale',
    );
    expect((await clinicFixtures.medicalSales.get(id)).voidedAt).not.toBeNull();
    expect(notifyMock.success).toHaveBeenCalledWith('Sale #978 voided');
  });

  it('stays closed without a target', () => {
    renderMedicalDrawer(<MedicalFlowConfirm target={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
