import { Outlet } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { fetchCredit } from '@/shared/api/clinic/credits-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { creditRow, TEST_CREDIT_ID } from '@/tests/utils/payments-doubles.ts';

import {
  renderPendingRoutes,
  resetPendingRoutes,
} from '../../__tests__/integration/pending-test-router.tsx';
import { usePendingDialogRoute } from './usePendingDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/clinic/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCredit: vi.fn(),
}));

const PENDING = '/organization/acme/payments/pending';

/** CR-2: open, nothing settled. */
const OPEN = creditRow({
  id: 'pcr_open00000000000000002',
  seq: 2,
  settled: 0,
  left: 80,
  paymentIds: [],
});

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

/** Pending, the probe standing in for the page, for a member holding `codes`. */
function renderPending(url: string, codes?: readonly OrganizationPermission[]) {
  return renderPendingRoutes(url, { Page: Probe, codes });
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchCredit)
    .mockReset()
    .mockImplementation(async (id) => {
      if (id === OPEN.id) return OPEN;
      if (id === TEST_CREDIT_ID) return creditRow();
      throw new HttpError('Not found', 404, `/app/pending-credits/${id}`, 'GET', {});
    });
});
afterEach(() => resetPendingRoutes());

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

  it('opens a credit nothing has settled, by its id', async () => {
    renderPending(`${PENDING}/${OPEN.id}/edit`);
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'edit',
        creditId: OPEN.id,
        credit: 2,
        readOnly: false,
      }),
    );
    expect(fetchCredit).toHaveBeenCalledWith(OPEN.id);
  });

  it('opens it view only without payment:update', async () => {
    renderPending(`${PENDING}/${OPEN.id}/edit`, ['organization:read', 'payment:read']);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'edit', readOnly: true }));
  });

  it('sends a credit settled in part back to Pending, saying it can’t change (S:90)', async () => {
    const { router } = renderPending(`${PENDING}/${TEST_CREDIT_ID}/edit?status=open`);
    await waitFor(() => expect(router.state.location.pathname).toBe(PENDING));
    expect(router.state.location.search).toEqual({ status: ['open'] });
    expect(notifyMock.info).toHaveBeenCalledWith(
      i18n.t('pending.settledLocked', { ns: 'payments', ref: 'CR-1', amount: '₹50' }),
    );
    expect(read()).toEqual({ kind: 'none' });
  });

  it('sends a settled credit back with its state named', async () => {
    vi.mocked(fetchCredit).mockResolvedValue(
      creditRow({ status: 'got_back', settled: 80, left: 0 }),
    );
    const { router } = renderPending(`${PENDING}/${TEST_CREDIT_ID}/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(PENDING));
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

  it('refuses Add pending without payment:create: Pending, with the permission toast once', async () => {
    const { router } = renderPending(`${PENDING}/create`, [
      'organization:read',
      'payment:read',
    ]);
    await waitFor(() => expect(router.state.location.pathname).toBe(PENDING));
    expect(read()).toEqual({ kind: 'none' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});
