import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { deleteCredit, restoreCredit } from '@/shared/api/app/credits-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { creditRow, TEST_CREDIT_ID } from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { CreditDeleteConfirm } from './CreditDeleteConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteCredit: vi.fn(),
  restoreCredit: vi.fn(),
}));

const KAVYA = { id: TEST_CREDIT_ID, seq: 1, partyName: 'Kavya Mehta' };

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('Refused', 409, `/app/pending-credits/${TEST_CREDIT_ID}`, 'DELETE', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'Refused' },
  });

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(deleteCredit).mockReset().mockResolvedValue(undefined);
  vi.mocked(restoreCredit).mockReset().mockResolvedValue(creditRow());
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('CreditDeleteConfirm (payments.md:50)', () => {
  it('asks "Delete this pending?" with the party in the pill, deletes with the reason, and Undo restores it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <CreditDeleteConfirm credit={KAVYA} onClose={onClose} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this pending?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('Kavya Mehta');
    expect(await axeForDialog(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteCredit).toHaveBeenCalledWith({
      creditId: TEST_CREDIT_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(onClose).toHaveBeenCalled();
    expect(notifyMock.undo).toHaveBeenCalledWith('CR-1 deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() =>
      expect(restoreCredit).toHaveBeenCalledWith(TEST_CREDIT_ID, expect.any(String)),
    );
  });

  it('sends "Other" with its note', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreditDeleteConfirm credit={KAVYA} onClose={vi.fn()} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-other'));
    await user.type(
      within(dialog).getByTestId('confirm-note'),
      'Entered on the wrong person',
    );
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(deleteCredit).toHaveBeenCalledWith({
        creditId: TEST_CREDIT_ID,
        reason: 'other',
        note: 'Entered on the wrong person',
      }),
    );
  });

  it('says a credit settled in part meanwhile can’t be deleted, closes, and offers no Undo (409 credit_settled)', async () => {
    vi.mocked(deleteCredit).mockRejectedValue(conflict('credit_settled'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <CreditDeleteConfirm credit={KAVYA} onClose={onClose} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        i18n.t('pending.conflicts.settled', { ns: 'payments', ref: 'CR-1' }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('keeps the confirm open on another refusal, with the server’s reason', async () => {
    vi.mocked(deleteCredit).mockRejectedValue(conflict('something_else'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<CreditDeleteConfirm credit={KAVYA} onClose={onClose} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith('Refused'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the credit on "Keep it"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<CreditDeleteConfirm credit={KAVYA} onClose={onClose} />);
    await user.click(await screen.findByTestId('confirm-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(deleteCredit).not.toHaveBeenCalled();
  });

  it('is closed while no credit is set', async () => {
    const { router } = renderWithProviders(
      <CreditDeleteConfirm credit={null} onClose={vi.fn()} />,
    );
    await router.load();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
