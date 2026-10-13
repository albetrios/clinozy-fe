import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoice: vi.fn(),
}));

import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/app/invoices-api.ts';
import { CROSS_ROOM_PARAM } from '@/shared/app/app-referrer.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import {
  type CrossRoomDialog,
  CrossRoomDialogContext,
} from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { invoiceDetail } from '@/tests/utils/invoice-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';
import {
  TEST_INVOICE_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  renderInvoicesRoutes,
  resetInvoicesRoutes,
} from '../../__tests__/integration/invoices-test-router.tsx';
import { useInvoicesDialogRoute } from './useInvoicesDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const BASE = '/organization/acme/invoices';
const KAVYA = TEST_MONEY_PATIENT_ID;
/** A public id clinozy-be knows no invoice by (404). */
const MISSING = 'invc_gone00000000000000000';
/** A fixture-day link: no public id — "not found" at once, never sent. */
const FIXTURE_ID = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

/** Shows what the hook reads (an invoice by its seq), and closes through it. */
function Probe() {
  const { dialog, close, openEdit } = useInvoicesDialogRoute();
  let shown: unknown = dialog;
  if (dialog.kind === 'preview' || dialog.kind === 'edit') {
    shown = { kind: dialog.kind, seq: dialog.detail?.invoice.seq ?? null };
  } else if (dialog.kind === 'create' && dialog.source) {
    shown = { ...dialog, source: dialog.source.invoice.seq };
  }
  return (
    <>
      <output>{JSON.stringify(shown)}</output>
      <button type="button" onClick={close}>
        Close
      </button>
      <button type="button" onClick={() => openEdit(TEST_INVOICE_ID)}>
        Edit
      </button>
    </>
  );
}

const read = () => JSON.parse(screen.getByRole('status').textContent ?? '{}') as unknown;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchInvoice).mockImplementation(async (id) => {
    if (id !== TEST_INVOICE_ID) {
      throw new HttpError('not found', 404, `/app/invoices/${id}`, 'GET', {});
    }
    return invoiceDetail();
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(fetchInvoice).mockReset();
  resetInvoicesRoutes();
});

describe('useInvoicesDialogRoute (KICKOFF §4, D24; S:92–94)', () => {
  it('reads New invoice and its prefill: the type, the patient, the referrer', async () => {
    renderInvoicesRoutes(`${BASE}/create?type=consultation&patient=${KAVYA}&from=today`, {
      host: Probe,
    });
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'create',
        prefill: { type: 'consultation', patient: KAVYA, from: 'today' },
      }),
    );
  });

  it('reads a copy: New invoice opens once the invoice it copies is read (Copy invoice)', async () => {
    renderInvoicesRoutes(
      `${BASE}/create?type=clinic&patient=${KAVYA}&copyOf=${TEST_INVOICE_ID}&from=today`,
      { host: Probe },
    );
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'create',
        prefill: {
          type: 'clinic',
          patient: KAVYA,
          copyOf: TEST_INVOICE_ID,
          from: 'today',
        },
        source: 5,
      }),
    );
  });

  it('opens no copy of an invoice that is gone: back, "Invoice not found…"', async () => {
    const { router } = renderInvoicesRoutes(`${BASE}/create?copyOf=${MISSING}`, {
      host: Probe,
    });
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith(
        'Invoice not found · it may have been deleted',
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
  });

  it('reads an invoice’s preview and its edit once the invoice is read', async () => {
    const preview = renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}`, { host: Probe });
    await waitFor(() => expect(read()).toEqual({ kind: 'preview', seq: 5 }));
    preview.unmount();
    renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}/edit`, { host: Probe });
    await waitFor(() => expect(read()).toEqual({ kind: 'edit', seq: 5 }));
  });

  it('keeps `from` from the preview to the edit, and closes back to it', async () => {
    const user = userEvent.setup();
    const { router } = renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}?from=payments`, {
      host: Probe,
    });
    await waitFor(() => expect(read()).toEqual({ kind: 'preview', seq: 5 }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${BASE}/${TEST_INVOICE_ID}/edit`),
    );
    expect(router.state.location.search).toEqual({ from: 'payments' });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
  });

  it('closes back to another room that opened it; its edit opens over that room (A-P1)', async () => {
    const user = userEvent.setup();
    // The patient file is on clinozy-be: its referrer names a `pat_…` id.
    const file = `patients/${TEST_PATIENT_ID}/invoices`;
    const preview = renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}?from=${file}`, {
      host: Probe,
    });
    await waitFor(() => expect(read()).toEqual({ kind: 'preview', seq: 5 }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(preview.router.state.location.pathname).toBe(`/organization/acme/${file}`),
    );
    preview.unmount();

    const { router } = renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}?from=${file}`, {
      host: Probe,
    });
    await waitFor(() => expect(read()).toEqual({ kind: 'preview', seq: 5 }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const edit = `${BASE}/${TEST_INVOICE_ID}/edit?from=${encodeURIComponent(file)}`;
    await waitFor(() => expect(router.history.location.href).toBe(edit));
    expect(router.state.location.pathname).toBe(`/organization/acme/${file}`);
    expect(router.state.location.search).toEqual({
      [CROSS_ROOM_PARAM]: edit.replace('/organization/acme/', ''),
    });
  });

  it('closes to the Payments ledger without a referrer, and ignores one off the allow-list', async () => {
    const user = userEvent.setup();
    const { router } = renderInvoicesRoutes(`${BASE}/create?from=https://evil.example`, {
      host: Probe,
    });
    await waitFor(() => expect(read()).toMatchObject({ kind: 'create' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
  });

  it('opens nothing for an invoice that is gone: back, "Invoice not found…" (S:115)', async () => {
    const { router } = renderInvoicesRoutes(`${BASE}/${MISSING}`, { host: Probe });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Invoice not found · it may have been deleted',
    );
  });

  it('never sends a link that names no public id — not found at once', async () => {
    const { router } = renderInvoicesRoutes(`${BASE}/${FIXTURE_ID}`, { host: Probe });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
    expect(fetchInvoice).not.toHaveBeenCalled();
  });

  it('says a read that failed for another reason, with its Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchInvoice)
      .mockRejectedValueOnce(new HttpError('down', 503, '/app/invoices', 'GET', {}))
      .mockRejectedValueOnce(new HttpError('down', 503, '/app/invoices', 'GET', {}))
      .mockRejectedValueOnce(new HttpError('down', 503, '/app/invoices', 'GET', {}));
    function Failed() {
      const { dialog } = useInvoicesDialogRoute();
      if (dialog.kind !== 'preview') return null;
      return (
        <button type="button" onClick={dialog.retry}>
          {dialog.failed ? 'failed' : 'reading'}
        </button>
      );
    }
    renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}`, { host: Failed });
    await user.click(await screen.findByRole('button', { name: 'failed' }));
    await waitFor(() => expect(fetchInvoice).toHaveBeenCalledTimes(4));
  });

  it('turns a create link away for a member without payment:create, with the permission toast', async () => {
    const { router } = renderInvoicesRoutes(`${BASE}/create`, {
      host: Probe,
      permissions: ['organization:read', 'payment:read'],
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });

  it('turns a copy link away for a View-as role without Payments Create, the invoice it copies never read', async () => {
    const { router, queryClient } = renderInvoicesRoutes(
      `${BASE}/create?copyOf=${TEST_INVOICE_ID}`,
      { host: Probe, role: 'doctor' },
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: invoiceQueryKeys.detail('org_test', TEST_INVOICE_ID) }),
    ).toBeUndefined();
  });
});

describe('useInvoicesDialogRoute over another room (A-P1)', () => {
  /** The Probe on another page, reading the drawer route the host provides. */
  function over(dialog: CrossRoomDialog) {
    return function PageWithInvoice() {
      return (
        <CrossRoomDialogContext.Provider value={dialog}>
          <Probe />
        </CrossRoomDialogContext.Provider>
      );
    };
  }
  const drawer = (
    path: string,
    search: Record<string, unknown>,
    close: () => void,
    params: Record<string, string> = {},
  ): CrossRoomDialog => ({
    pathname: `${BASE}/${path}`,
    search,
    params: { organizationSlug: 'acme', ...params },
    close,
  });

  it('reads a copy from the drawer’s own route — the page behind has no say — and closes back to the page', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const { router } = renderInvoicesRoutes('/organization/acme/today?lane=checkout', {
      elsewhere: over(
        drawer(
          'create',
          { type: 'clinic', patient: KAVYA, copyOf: TEST_INVOICE_ID, from: 'today' },
          close,
        ),
      ),
    });
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'create',
        prefill: {
          type: 'clinic',
          patient: KAVYA,
          copyOf: TEST_INVOICE_ID,
          from: 'today',
        },
        source: 5,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/organization/acme/today');
  });

  it('goes back to the page behind on an invoice that is gone, and on a create link without Payments Create', async () => {
    const close = vi.fn();
    const gone = renderInvoicesRoutes('/organization/acme/today', {
      elsewhere: over(drawer(MISSING, { from: 'today' }, close, { invoiceId: MISSING })),
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Invoice not found · it may have been deleted',
    );
    gone.unmount();

    close.mockReset();
    notifyMock.info.mockReset();
    renderInvoicesRoutes('/organization/acme/today', {
      permissions: ['organization:read'],
      elsewhere: over(drawer('create', { from: 'today' }, close)),
    });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'You do not have permission to perform this action.',
    );
  });
});
