import { Outlet } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { settleCredit } from '@/shared/api/clinic/credits-api.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../../__tests__/integration/payments-test-router.tsx';
import { usePaymentsDialogRoute } from './usePaymentsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const LEDGER = '/organization/acme/payments';
const RHEA = patientRef('Rhea Shah');
const MISSING = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

/** Shows what the hook reads (the entry by its seq), and closes through it. */
function Probe() {
  const { dialog, close } = usePaymentsDialogRoute();
  const shown =
    dialog.kind === 'edit'
      ? { ...dialog, payment: dialog.payment ? dialog.payment.seq : null }
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

describe('usePaymentsDialogRoute (KICKOFF §4, D24)', () => {
  it('opens nothing over the bare ledger', async () => {
    renderPaymentsRoutes(LEDGER, { ledger: Probe });
    await waitFor(() => expect(read()).toEqual({ kind: 'none' }));
  });

  it('reads Receive and its prefill: the patient, the invoice, the referrer', async () => {
    renderPaymentsRoutes(
      `${LEDGER}/receive?patient=${RHEA}&invoice=${ref.invoice(785)}&from=today`,
      { ledger: Probe },
    );
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'receive',
        prefill: { patient: RHEA, invoice: ref.invoice(785), from: 'today' },
      }),
    );
  });

  it('reads Send payment on its bill, and Day close on its day and branch', async () => {
    const pay = renderPaymentsRoutes(`${LEDGER}/pay?bill=md:${ref.purchaseOrder(431)}`, {
      ledger: Probe,
    });
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'pay',
        prefill: { bill: `md:${ref.purchaseOrder(431)}` },
      }),
    );
    pay.unmount();
    renderPaymentsRoutes(`${LEDGER}/day-close?date=2026-10-02`, { ledger: Probe });
    await waitFor(() =>
      expect(read()).toEqual({ kind: 'dayClose', search: { date: '2026-10-02' } }),
    );
  });

  it('opens an open day’s entry, editable for a member with Edit', async () => {
    renderPaymentsRoutes(`${LEDGER}/${ref.payment(310)}/edit`, { ledger: Probe });
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'edit',
        paymentId: ref.payment(310),
        payment: 310,
        readOnly: false,
      }),
    );
  });

  it('sends a closed day’s entry back to the ledger, named (S:87)', async () => {
    const { router } = renderPaymentsRoutes(
      `${LEDGER}/${ref.payment(305)}/edit?direction=paid`,
      { ledger: Probe },
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(router.state.location.search).toEqual({ direction: 'paid' });
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-305 · Day closed');
    expect(read()).toEqual({ kind: 'none' });
  });

  it('sends a pending credit’s entry back, named as the credit’s', async () => {
    const { paymentSeq } = await settleCredit(ref.pendingCredit(2), {
      action: 'give_back',
      splits: [{ mode: 'cash', amount: 50_000 }],
    });
    const settled = clinicFixtures.payments.snapshot((row) => row.seq === paymentSeq)[0];
    const { router } = renderPaymentsRoutes(`${LEDGER}/${settled?.id ?? ''}/edit`, {
      ledger: Probe,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(notifyMock.info).toHaveBeenCalledWith(`PAY-${paymentSeq} · From CR-2`);
  });

  it('sends an unknown entry back with "Payment not found" (S:115)', async () => {
    const { router } = renderPaymentsRoutes(`${LEDGER}/${MISSING}/edit`, {
      ledger: Probe,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(notifyMock.info).toHaveBeenCalledWith(
      expect.stringContaining('Payment not found'),
    );
  });

  it('closes Receive onto its referrer, else onto the ledger with its own params', async () => {
    const user = userEvent.setup();
    const fromToday = renderPaymentsRoutes(
      `${LEDGER}/receive?patient=${RHEA}&from=today`,
      {
        ledger: Probe,
      },
    );
    await waitFor(() => expect(read()).toMatchObject({ kind: 'receive' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(fromToday.router.state.location.pathname).toBe('/organization/acme/today'),
    );
    fromToday.unmount();

    const own = renderPaymentsRoutes(
      `${LEDGER}/receive?patient=${RHEA}&from=https%3A%2F%2Fevil.example&q=rhea`,
      { ledger: Probe },
    );
    await waitFor(() => expect(read()).toMatchObject({ kind: 'receive' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(own.router.state.location.pathname).toBe(LEDGER));
    expect(own.router.state.location.search).toEqual({ q: 'rhea' });
  });

  it('refuses Receive and Pay without Create: the ledger, with the permission toast once', async () => {
    const { router } = renderPaymentsRoutes(`${LEDGER}/receive`, {
      ledger: Probe,
      role: 'therapist',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(read()).toEqual({ kind: 'none' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});
