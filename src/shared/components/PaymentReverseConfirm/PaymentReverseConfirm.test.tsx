import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { reversePayment } from '@/shared/api/app/payments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { ledgerRow, TEST_PAYMENT_ID } from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PaymentReverseConfirm } from './PaymentReverseConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  reversePayment: vi.fn(),
}));

/** PAY-5, its day closed. */
const SETTLED = ledgerRow({ isSettled: true });

/** The payments namespace's words, as the suite's locale has them. */
const words = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: 'payments', ...options });

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('Refused', 409, '/app/payments/x/reverse', 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'Refused' },
  });

/** Open the confirm on PAY-5, pick `reason` (and type `note`) and press Reverse. */
async function confirm(reason: string, note = '') {
  const user = userEvent.setup();
  const onClose = vi.fn();
  renderWithProviders(<PaymentReverseConfirm entry={SETTLED} onClose={onClose} />);
  const dialog = await screen.findByTestId('confirm-dialog');
  await user.click(within(dialog).getByRole('radio', { name: reason }));
  if (note) await user.type(within(dialog).getByRole('textbox'), note);
  await user.click(within(dialog).getByTestId('confirm-accept'));
  return { dialog, onClose };
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(reversePayment).mockReset();
});

describe('PaymentReverseConfirm', () => {
  it('asks about the closed day’s entry with the ledger’s reasons', async () => {
    const { baseElement } = renderWithProviders(
      <PaymentReverseConfirm entry={SETTLED} onClose={vi.fn()} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('PAY-5');
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Entered twice', 'Wrong amount', 'Wrong patient or payee', 'Other']);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('reverses with the chip and the note as its reason, naming the reversal', async () => {
    vi.mocked(reversePayment).mockResolvedValue(ledgerRow({ seq: 9, kind: 'reversal' }));
    const { onClose } = await confirm('Wrong amount', '₹50, not ₹150');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reversePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: TEST_PAYMENT_ID,
        reason: 'Wrong amount · ₹50, not ₹150',
      }),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      words('reverseEntry.reversed', { ref: 'PAY-5', reversal: 'PAY-9' }),
    );
    // Final: no Undo.
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('sends "Other" as the note alone', async () => {
    vi.mocked(reversePayment).mockResolvedValue(ledgerRow({ seq: 9, kind: 'reversal' }));
    await confirm('Other', 'Bank returned it');
    await waitFor(() =>
      expect(reversePayment).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Bank returned it' }),
      ),
    );
  });

  it.each([
    ['already_reversed', 'reverseEntry.blocked.alreadyReversed'],
    ['day_open', 'reverseEntry.blocked.dayOpen'],
    ['day_closed', 'reverseEntry.blocked.dayClosed'],
  ])('closes on a %s refusal and says why in the room’s words', async (reason, key) => {
    vi.mocked(reversePayment).mockRejectedValue(conflict(reason));
    const { onClose } = await confirm('Entered twice');
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(words(key, { ref: 'PAY-5' })),
    );
    expect(onClose).toHaveBeenCalled();
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it('keeps the confirm open on any other failure', async () => {
    vi.mocked(reversePayment).mockRejectedValue(new Error('offline'));
    const { onClose, dialog } = await confirm('Entered twice');
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it('is closed while no entry is set', async () => {
    const { router } = renderWithProviders(
      <PaymentReverseConfirm entry={null} onClose={vi.fn()} />,
    );
    await router.load();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
