import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  cancelPurchaseOrder: vi.fn(),
  restorePurchaseOrder: vi.fn(),
  voidSale: vi.fn(),
  restoreSale: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  purchaseOrderRow,
  saleRow,
  TEST_PURCHASE_ORDER_ID,
  TEST_SALE_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  cancelPurchaseOrder,
  restorePurchaseOrder,
  restoreSale,
  voidSale,
} from '../../medical-records-api.ts';
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
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
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

describe('MedicalFlowConfirm (medical.md:357–368)', () => {
  it('cancels an Ordered purchase order with the API’s reason, and Undo restores it', async () => {
    vi.mocked(cancelPurchaseOrder).mockResolvedValue(undefined);
    vi.mocked(restorePurchaseOrder).mockResolvedValue(purchaseOrderRow());
    await confirm(
      { kind: 'cancelOrder', id: TEST_PURCHASE_ORDER_ID, seq: 430, record: '₹4,236' },
      'Cancel this purchase order?',
      'Ordered by mistake',
      'Cancel order',
    );
    expect(cancelPurchaseOrder).toHaveBeenCalledWith(
      TEST_PURCHASE_ORDER_ID,
      'mistake',
      null,
    );
    // One answer: "PO #430 cancelled" with Undo — no plain success beside it.
    expect(notifyMock.success).not.toHaveBeenCalled();
    pressUndo('PO #430 cancelled');
    await waitFor(() =>
      expect(restorePurchaseOrder).toHaveBeenCalledWith(
        TEST_PURCHASE_ORDER_ID,
        expect.any(String),
      ),
    );
  });

  it('voids an unpaid sale with the API’s reason, and Undo restores it', async () => {
    vi.mocked(voidSale).mockResolvedValue(undefined);
    vi.mocked(restoreSale).mockResolvedValue(saleRow());
    await confirm(
      { kind: 'voidSale', id: TEST_SALE_ID, seq: 978, record: 'Priya Shah' },
      'Void this sale?',
      'Billed by mistake',
      'Void sale',
    );
    expect(voidSale).toHaveBeenCalledWith(TEST_SALE_ID, 'billed_by_mistake', null);
    expect(notifyMock.success).not.toHaveBeenCalled();
    pressUndo('Sale #978 voided');
    await waitFor(() =>
      expect(restoreSale).toHaveBeenCalledWith(TEST_SALE_ID, expect.any(String)),
    );
  });

  it('stays closed without a target', () => {
    renderMedicalDrawer(<MedicalFlowConfirm target={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
