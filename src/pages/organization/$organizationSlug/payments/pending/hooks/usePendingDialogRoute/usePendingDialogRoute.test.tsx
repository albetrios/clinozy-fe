import { Outlet } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../../../__tests__/integration/payments-test-router.tsx';
import { usePendingDialogRoute } from './usePendingDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const PENDING = '/organization/acme/payments/pending';

/** Shows what the hook reads (the credit by its seq), and closes through it. */
function Probe() {
  const { dialog, close } = usePendingDialogRoute();
  const shown =
    dialog.kind === 'edit'
      ? { ...dialog, credit: dialog.credit ? dialog.credit.seq : null }
      : dialog;
  return (
    <>
      <output>{JSON.stringify(shown)}</output>
      <button type="button" onClick={close}>
        Close
      </button>
      <Outlet />
    </>
  );
}

const read = () => JSON.parse(screen.getByRole('status').textContent ?? '{}') as unknown;

/** The Payments routes, the probe standing in for the Pending page. */
function renderPending(url: string, options: { role?: Role } = {}) {
  return renderPaymentsRoutes(url, { ...options, pending: Probe });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetPaymentsRoutes();
  resetClinicFixtures();
});

describe('usePendingDialogRoute (KICKOFF §4, D24)', () => {
  it('opens nothing over Pending', async () => {
    renderPending(PENDING);
    await waitFor(() => expect(read()).toEqual({ kind: 'none' }));
  });

  it('reads Add pending, its way from Pending’s own `direction` when it names one', async () => {
    const give = renderPending(`${PENDING}/create?direction=give`);
    await waitFor(() =>
      expect(read()).toEqual({ kind: 'create', prefill: { direction: 'give' } }),
    );
    give.unmount();
    renderPending(`${PENDING}/create?direction=give,take`);
    await waitFor(() => expect(read()).toEqual({ kind: 'create', prefill: {} }));
  });

  it('opens an open credit; a settled one goes back with its state named (S:90)', async () => {
    const open = renderPending(`${PENDING}/${ref.pendingCredit(2)}/edit`);
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'edit',
        creditId: ref.pendingCredit(2),
        credit: 2,
        readOnly: false,
      }),
    );
    open.unmount();
    await clinicFixtures.pendingCredits.update(ref.pendingCredit(1), {
      status: 'got_back',
      settledAt: NOW.toISOString(),
    });
    const settled = renderPending(`${PENDING}/${ref.pendingCredit(1)}/edit?status=open`);
    await waitFor(() => expect(settled.router.state.location.pathname).toBe(PENDING));
    expect(settled.router.state.location.search).toEqual({ status: ['open'] });
    expect(notifyMock.info).toHaveBeenCalledWith('CR-1 · Received');
  });

  it('closes onto Pending with its own params', async () => {
    const user = userEvent.setup();
    const { router } = renderPending(`${PENDING}/create?direction=take&q=medline`);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'create' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PENDING));
    expect(router.state.location.search).toEqual({ direction: ['take'], q: 'medline' });
  });

  it('refuses Add pending without Create: Pending, with the permission toast once', async () => {
    const { router } = renderPending(`${PENDING}/create`, { role: 'therapist' });
    await waitFor(() => expect(router.state.location.pathname).toBe(PENDING));
    expect(read()).toEqual({ kind: 'none' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});
