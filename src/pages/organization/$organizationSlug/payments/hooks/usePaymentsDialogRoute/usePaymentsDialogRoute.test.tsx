import { Outlet } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { fetchPayment } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import {
  type CrossRoomDialog,
  CrossRoomDialogContext,
} from '@/shared/hooks/useCrossRoomDialog/index.ts';
import {
  ledgerRow,
  TEST_INVOICE_ID,
  TEST_MONEY_PATIENT_ID,
  TEST_PAYMENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  PAYMENTS_OWNER_CODES,
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../../__tests__/integration/payments-test-router.tsx';
import { usePaymentsDialogRoute } from './usePaymentsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPayment: vi.fn(),
}));

const LEDGER = '/organization/acme/payments';
const KAVYA = TEST_MONEY_PATIENT_ID;
const MISSING = 'pay_missing00000000000000';
const STOCK_BILL = 'spur_ft5aosl5u6tyxqidd2e1a';

/** The entries the API knows, by id: an open day's PAY-5, a closed day's, a credit's, a reversal. */
const ENTRIES: Record<string, LedgerRow> = {
  [TEST_PAYMENT_ID]: ledgerRow(),
  pay_closed000000000000000: ledgerRow({
    id: 'pay_closed000000000000000',
    seq: 305,
    isSettled: true,
    editCount: 0,
  }),
  pay_credit000000000000000: ledgerRow({
    id: 'pay_credit000000000000000',
    seq: 6,
    pendingCreditSeq: 2,
  }),
  pay_reversal0000000000000: ledgerRow({
    id: 'pay_reversal0000000000000',
    seq: 9,
    kind: 'reversal',
    direction: 'paid',
  }),
};

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
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchPayment)
    .mockReset()
    .mockImplementation(async (id) => {
      const entry = ENTRIES[id];
      if (!entry) throw new HttpError('Not found', 404, `/app/payments/${id}`, 'GET', {});
      return entry;
    });
});
afterEach(() => resetPaymentsRoutes());

/** The harness as an Owner — or a member holding `codes`. */
const routes = (url: string, codes: readonly string[] = PAYMENTS_OWNER_CODES) =>
  renderPaymentsRoutes(url, { ledger: Probe, permissions: codes as never });

describe('usePaymentsDialogRoute (KICKOFF §4, D24)', () => {
  it('opens nothing over the bare ledger', async () => {
    routes(LEDGER);
    await waitFor(() => expect(read()).toEqual({ kind: 'none' }));
  });

  it('reads Receive and its prefill: the patient, the invoice, the referrer', async () => {
    routes(`${LEDGER}/receive?patient=${KAVYA}&invoice=${TEST_INVOICE_ID}&from=today`);
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'receive',
        prefill: { patient: KAVYA, invoice: TEST_INVOICE_ID, from: 'today' },
      }),
    );
  });

  it('reads Send payment on its bill, and Day close on its day and branch', async () => {
    const pay = routes(`${LEDGER}/pay?bill=${STOCK_BILL}`);
    await waitFor(() =>
      expect(read()).toEqual({ kind: 'pay', prefill: { bill: STOCK_BILL } }),
    );
    pay.unmount();
    routes(`${LEDGER}/day-close?date=2026-10-02`);
    await waitFor(() =>
      expect(read()).toEqual({ kind: 'dayClose', search: { date: '2026-10-02' } }),
    );
  });

  it('opens an open day’s entry, editable with payment:update — view only without', async () => {
    const owner = routes(`${LEDGER}/${TEST_PAYMENT_ID}/edit`);
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'edit',
        paymentId: TEST_PAYMENT_ID,
        payment: 5,
        readOnly: false,
      }),
    );
    owner.unmount();
    routes(`${LEDGER}/${TEST_PAYMENT_ID}/edit`, ['organization:read', 'payment:read']);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'edit', readOnly: true }));
  });

  it('sends a closed day’s entry back to the ledger, named (S:87)', async () => {
    const { router } = routes(`${LEDGER}/pay_closed000000000000000/edit?direction=paid`);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(router.state.location.search).toEqual({ direction: 'paid' });
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-305 · Day closed');
    expect(read()).toEqual({ kind: 'none' });
  });

  it('sends a pending credit’s entry back, named as the credit’s', async () => {
    const { router } = routes(`${LEDGER}/pay_credit000000000000000/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-6 · From CR-2');
  });

  it('sends a reversal back: its money is fixed, it is deleted on its day', async () => {
    const { router } = routes(`${LEDGER}/pay_reversal0000000000000/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(notifyMock.info).toHaveBeenCalledWith(
      i18n.t('ledger.fixedEntry', { ns: 'payments', ref: 'PAY-9' }),
    );
    expect(read()).toEqual({ kind: 'none' });
  });

  it('sends an unknown entry back with "Payment not found" (S:115)', async () => {
    const { router } = routes(`${LEDGER}/${MISSING}/edit`);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(notifyMock.info).toHaveBeenCalledWith(
      expect.stringContaining('Payment not found'),
    );
  });

  it('closes Receive onto its referrer, else onto the ledger with its own params', async () => {
    const user = userEvent.setup();
    const fromToday = routes(`${LEDGER}/receive?patient=${KAVYA}&from=today`);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'receive' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(fromToday.router.state.location.pathname).toBe('/organization/acme/today'),
    );
    fromToday.unmount();

    const own = routes(
      `${LEDGER}/receive?patient=${KAVYA}&from=https%3A%2F%2Fevil.example&q=rhea`,
    );
    await waitFor(() => expect(read()).toMatchObject({ kind: 'receive' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(own.router.state.location.pathname).toBe(LEDGER));
    expect(own.router.state.location.search).toEqual({ q: 'rhea' });
  });

  it('refuses Receive and Pay without payment:create: the ledger, with the permission toast once', async () => {
    const { router } = routes(`${LEDGER}/receive`, ['organization:read', 'payment:read']);
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    expect(read()).toEqual({ kind: 'none' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});

describe('usePaymentsDialogRoute over another room (A-P1)', () => {
  /** The Probe over Pending, reading Receive from the drawer route the host provides. */
  function overPending(dialog: CrossRoomDialog) {
    return function PendingWithReceive() {
      return (
        <CrossRoomDialogContext.Provider value={dialog}>
          <Probe />
        </CrossRoomDialogContext.Provider>
      );
    };
  }
  const receive = (close: () => void): CrossRoomDialog => ({
    pathname: `${LEDGER}/receive`,
    search: { patient: KAVYA, from: 'payments/pending' },
    params: { organizationSlug: 'acme' },
    close,
  });

  it('reads Receive from the drawer’s own route, and closes back to the page behind', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { router } = renderPaymentsRoutes(`${LEDGER}/pending?direction=give`, {
      pending: overPending(receive(close)),
      permissions: PAYMENTS_OWNER_CODES,
    });
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'receive',
        prefill: { patient: KAVYA, from: 'payments/pending' },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe(`${LEDGER}/pending`);
  });

  it('refuses Receive without Create there too: the toast once, and back to the page behind', async () => {
    const close = vi.fn();
    renderPaymentsRoutes(`${LEDGER}/pending`, {
      pending: overPending(receive(close)),
      permissions: ['organization:read', 'payment:read'],
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(read()).toEqual({ kind: 'none' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'You do not have permission to perform this action.',
    );
  });
});
