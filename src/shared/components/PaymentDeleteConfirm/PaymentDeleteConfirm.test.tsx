import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { deletePayment } from '@/shared/api/clinic/payments-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from './PaymentDeleteConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/clinic/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deletePayment: vi.fn(),
}));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Rhea's ₹600 UPI against Sale #785 (₹700 still due) — the parked Medical room's fixture ledger. */
const RECEIPT: PaymentDeleteTarget = {
  entry: {
    id: ref.payment(5512),
    seq: 5512,
    kind: 'receipt',
    amount: 600,
    invoice: { seq: 785, number: '2026-27/0785', type: 'medical', due: 700 },
  },
  dueAfter: 1300,
};
/** "Tea & snacks", ₹260 cash. */
const EXPENSE: PaymentDeleteTarget = {
  entry: {
    id: ref.payment(310),
    seq: 310,
    kind: 'expense',
    amount: 260,
    invoice: null,
  },
};

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string, detail: string) =>
  new HttpError(detail, 409, '/app/payments/x', 'DELETE', {
    error: { type: 'request_error', code: 'conflict', reason, detail },
  });

const isLive = (id: string) =>
  clinicFixtures.payments.snapshot((payment) => payment.id === id).length === 1;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('PaymentDeleteConfirm (payments.md:34)', () => {
  it('asks about the entry with the invoice it reopens, and removes it with a reason', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <PaymentDeleteConfirm
        target={RECEIPT}
        onClose={onClose}
        onDeleted={onDeleted}
        fixture
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this payment?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('PAY-5512');
    expect(
      within(dialog).getByText(
        'Allowed until the day is closed. Invoice #785 goes back to ₹1,300 due. The deletion is kept in the audit log.',
      ),
    ).toBeInTheDocument();
    // The ledger's reasons, "Other" last.
    expect(
      within(dialog)
        .getAllByTestId(/^confirm-reason-/)
        .map((chip) => chip.textContent),
    ).toEqual(['Entered twice', 'Wrong amount', 'Wrong patient or payee', 'Other']);
    expect(await axeForDialog(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByTestId('confirm-reason-wrong-amount'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    expect(isLive(ref.payment(5512))).toBe(false);
    // A reason the schema lacks travels as "other", its label in the note (D32).
    const removed = await clinicFixtures.payments.get(ref.payment(5512), {
      includeDeleted: true,
    });
    expect(removed).toMatchObject({ deleteReason: 'other', deleteNote: 'Wrong amount' });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'PAY-5512 removed · invoice balance restored',
      { onUndo: expect.any(Function) },
    );
  });

  it('says only the audit sentence for an expense, and Undo puts it back', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PaymentDeleteConfirm target={EXPENSE} onClose={vi.fn()} fixture />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(
      within(dialog).getByText(
        'Allowed until the day is closed. The deletion is kept in the audit log.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(notifyMock.undo).toHaveBeenCalledTimes(1));
    expect(notifyMock.undo).toHaveBeenCalledWith('PAY-310 removed', {
      onUndo: expect.any(Function),
    });
    expect(isLive(ref.payment(310))).toBe(false);
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(isLive(ref.payment(310))).toBe(true));
  });

  it('deletes a Payments entry on clinozy-be, not on the fixture ledger', async () => {
    vi.mocked(deletePayment).mockResolvedValue();
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    renderWithProviders(
      <PaymentDeleteConfirm target={EXPENSE} onClose={vi.fn()} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deletePayment).toHaveBeenCalledWith({
      paymentId: ref.payment(310),
      reason: 'duplicate',
      note: null,
    });
    expect(isLive(ref.payment(310))).toBe(true);
  });

  it.each([
    ['day_closed', 'deleteEntry.blocked.dayClosed'],
    ['more_than_paid', 'deleteEntry.blocked.moreThanPaid'],
  ])('closes on a %s refusal and says why in the room’s words', async (reason, key) => {
    vi.mocked(deletePayment).mockRejectedValue(conflict(reason, 'Server words'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <PaymentDeleteConfirm target={EXPENSE} onClose={onClose} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        i18n.t(key, { ns: 'payments', ref: 'PAY-310' }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('keeps the confirm open on any other failure, with the server’s reason', async () => {
    vi.mocked(deletePayment).mockRejectedValue(
      new HttpError('Not allowed', 403, '/app/payments/x', 'DELETE', {
        error: { type: 'request_error', code: 'forbidden', detail: 'Not allowed' },
      }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<PaymentDeleteConfirm target={EXPENSE} onClose={onClose} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith('Not allowed'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('keeps the entry on "Keep it"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <PaymentDeleteConfirm target={EXPENSE} onClose={onClose} fixture />,
    );
    await user.click(await screen.findByTestId('confirm-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(isLive(ref.payment(310))).toBe(true);
  });

  it('is closed while no entry is set', async () => {
    const { router } = renderWithProviders(
      <PaymentDeleteConfirm target={null} onClose={vi.fn()} />,
    );
    await router.load();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
