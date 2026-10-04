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

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const TANVI = { id: ref.pendingCredit(2), seq: 2, partyName: 'Tanvi Shah' };

const isLive = () =>
  clinicFixtures.pendingCredits.snapshot((credit) => credit.id === TANVI.id).length === 1;

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

describe('CreditDeleteConfirm (payments.md:50)', () => {
  it('asks "Delete this pending?" with the party in the pill, and removes it with a reason', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <CreditDeleteConfirm credit={TANVI} onClose={onClose} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this pending?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('Tanvi Shah');
    expect(await axeForDialog(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    expect(isLive()).toBe(false);
    expect(notifyMock.undo).toHaveBeenCalledWith('CR-2 deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(isLive()).toBe(true));
  });

  it('keeps the credit on "Keep it"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<CreditDeleteConfirm credit={TANVI} onClose={onClose} />);
    await user.click(await screen.findByTestId('confirm-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(isLive()).toBe(true);
  });

  it('is closed while no credit is set', async () => {
    const { router } = renderWithProviders(
      <CreditDeleteConfirm credit={null} onClose={vi.fn()} />,
    );
    await router.load();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
