import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
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

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Rhea's ₹600 UPI against Sale #785 (₹700 still due). */
const RECEIPT: PaymentDeleteTarget = {
  entry: {
    id: ref.payment(5512),
    seq: 5512,
    kind: 'receipt',
    amount: 60_000,
    invoice: { seq: 785, type: 'medical', due: 70_000 },
  },
  dueAfter: 130_000,
};
/** "Tea & snacks", ₹260 cash. */
const EXPENSE: PaymentDeleteTarget = {
  entry: {
    id: ref.payment(310),
    seq: 310,
    kind: 'expense',
    amount: 26_000,
    invoice: null,
  },
};

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
      <PaymentDeleteConfirm target={RECEIPT} onClose={onClose} onDeleted={onDeleted} />,
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
    renderWithProviders(<PaymentDeleteConfirm target={EXPENSE} onClose={vi.fn()} />);
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

  it('keeps the entry on "Keep it"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<PaymentDeleteConfirm target={EXPENSE} onClose={onClose} />);
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
