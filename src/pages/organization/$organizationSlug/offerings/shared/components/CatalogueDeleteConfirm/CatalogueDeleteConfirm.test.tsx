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

const CORN = ref.offering(270);
const MONSOON = ref.offer(28);
const liveOffering = () =>
  clinicFixtures.offerings.snapshot((offering) => offering.id === CORN).length === 1;
const liveOffer = () =>
  clinicFixtures.offers.snapshot((offer) => offer.id === MONSOON).length === 1;

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('CatalogueDeleteConfirm (KICKOFF §6.11 Delete confirm)', () => {
  it('deletes an offering with the reason, then offers Undo for "Offering #270 removed"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <CatalogueDeleteConfirm
        target={{ kind: 'offering', id: CORN, seq: 270, record: 'Corn Removal' }}
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
    expect(liveOffering()).toBe(false);
    expect(notifyMock.undo).toHaveBeenCalledWith('Offering #270 removed', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => Promise<unknown> },
    ];
    await onUndo();
    await waitFor(() => expect(liveOffering()).toBe(true));
  });

  it('deletes an offer, naming it in the pill and the toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CatalogueDeleteConfirm
        target={{
          kind: 'offer',
          id: MONSOON,
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
    await waitFor(() => expect(liveOffer()).toBe(false));
    expect(notifyMock.undo).toHaveBeenCalledWith('Monsoon ₹500 off removed', {
      onUndo: expect.any(Function),
    });
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
        target={{ kind: 'offering', id: CORN, seq: 270, record: 'Corn Removal' }}
        onClose={onClose}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(onClose).toHaveBeenCalled();
    expect(liveOffering()).toBe(true);
  });
});
