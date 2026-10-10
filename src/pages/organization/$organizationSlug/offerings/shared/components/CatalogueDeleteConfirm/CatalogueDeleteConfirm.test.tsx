import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteOffering: vi.fn(),
  restoreOffering: vi.fn(),
  deleteOffer: vi.fn(),
  restoreOffer: vi.fn(),
}));
import {
  deleteOffer,
  deleteOffering,
  restoreOffer,
  restoreOffering,
} from '@/shared/api/clinic/offerings-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { offeringRecord, offerRecord } from '@/tests/utils/offering-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { CatalogueDeleteConfirm } from './CatalogueDeleteConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const CORN = offeringRecord({ offeringNumber: 270, name: 'Corn Removal' });
const MONSOON = offerRecord({ name: 'Monsoon ₹500 off' });

beforeEach(() => {
  vi.resetAllMocks();
  viewport.tier = 'desktop';
  signInTestMember();
  vi.mocked(deleteOffering).mockResolvedValue();
  vi.mocked(restoreOffering).mockResolvedValue(CORN);
  vi.mocked(deleteOffer).mockResolvedValue();
  vi.mocked(restoreOffer).mockResolvedValue(MONSOON);
});

/** The Undo the "removed" toast offered. */
function undoOfToast() {
  const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
    string,
    { onUndo: () => Promise<unknown> },
  ];
  return onUndo;
}

describe('CatalogueDeleteConfirm (KICKOFF §6.11 Delete confirm)', () => {
  it('deletes an offering with the reason, then offers Undo for "Offering #270 removed"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <CatalogueDeleteConfirm
        target={{
          kind: 'offering',
          id: CORN.id,
          offeringNumber: 270,
          record: 'Corn Removal',
        }}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offering?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Corn Removal',
    );
    expect(
      within(dialog).getByText(
        'It disappears from lists and pickers. You can undo from the toast right after.',
      ),
    ).toBeInTheDocument();
    expect(await axeForDialog(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteOffering).toHaveBeenCalledWith({
      offeringId: CORN.id,
      reason: 'not_needed',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Offering #270 removed', {
      onUndo: expect.any(Function),
    });

    await undoOfToast()();
    await waitFor(() =>
      expect(restoreOffering).toHaveBeenCalledWith(CORN.id, expect.any(String)),
    );
  });

  it('deletes an offer, naming it in the pill and the toast, and restores it on Undo', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CatalogueDeleteConfirm
        target={{
          kind: 'offer',
          id: MONSOON.id,
          name: 'Monsoon ₹500 off',
          record: 'Monsoon ₹500 off',
        }}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offer?')).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(deleteOffer).toHaveBeenCalledWith({
        offerId: MONSOON.id,
        reason: 'duplicate',
        note: null,
      }),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Monsoon ₹500 off removed', {
      onUndo: expect.any(Function),
    });

    await undoOfToast()();
    await waitFor(() =>
      expect(restoreOffer).toHaveBeenCalledWith(MONSOON.id, expect.any(String)),
    );
  });

  it('stays closed without a target, and "Keep it" closes it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = renderWithProviders(
      <CatalogueDeleteConfirm target={null} onClose={onClose} />,
    );
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    unmount();
    renderWithProviders(
      <CatalogueDeleteConfirm
        target={{
          kind: 'offering',
          id: CORN.id,
          offeringNumber: 270,
          record: 'Corn Removal',
        }}
        onClose={onClose}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(onClose).toHaveBeenCalled();
    expect(deleteOffering).not.toHaveBeenCalled();
  });
});
