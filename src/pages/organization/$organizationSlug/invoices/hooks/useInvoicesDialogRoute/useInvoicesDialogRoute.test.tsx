import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';

import {
  renderInvoicesRoutes,
  resetInvoicesRoutes,
} from '../../__tests__/integration/invoices-test-router.tsx';
import { useInvoicesDialogRoute } from './useInvoicesDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const BASE = '/organization/acme/invoices';
const DHARTI = patientRef('Dharti Galani');
const MISSING = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

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
      <button type="button" onClick={() => openEdit(ref.invoice(787))}>
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
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetInvoicesRoutes();
  resetClinicFixtures();
});

describe('useInvoicesDialogRoute (KICKOFF §4, D24; S:92–94)', () => {
  it('reads New invoice and its prefill: the type, the patient, the referrer', async () => {
    renderInvoicesRoutes(
      `${BASE}/create?type=consultation&patient=${DHARTI}&from=today`,
      {
        host: Probe,
      },
    );
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'create',
        prefill: { type: 'consultation', patient: DHARTI, from: 'today' },
      }),
    );
  });

  it('reads a copy: New invoice opens once the invoice it copies is read (Copy invoice)', async () => {
    renderInvoicesRoutes(
      `${BASE}/create?type=clinic&patient=${DHARTI}&copyOf=${ref.invoice(787)}&from=today`,
      { host: Probe },
    );
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'create',
        prefill: {
          type: 'clinic',
          patient: DHARTI,
          copyOf: ref.invoice(787),
          from: 'today',
        },
        source: 787,
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
    const preview = renderInvoicesRoutes(`${BASE}/${ref.invoice(787)}`, { host: Probe });
    await waitFor(() => expect(read()).toEqual({ kind: 'preview', seq: 787 }));
    preview.unmount();
    renderInvoicesRoutes(`${BASE}/${ref.invoice(787)}/edit`, { host: Probe });
    await waitFor(() => expect(read()).toEqual({ kind: 'edit', seq: 787 }));
  });

  it('closes back to the room that opened it, keeping `from` from the preview to the edit', async () => {
    const user = userEvent.setup();
    const { router } = renderInvoicesRoutes(
      `${BASE}/${ref.invoice(787)}?from=patients/${DHARTI}/invoices`,
      { host: Probe },
    );
    await waitFor(() => expect(read()).toEqual({ kind: 'preview', seq: 787 }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${BASE}/${ref.invoice(787)}/edit`),
    );
    expect(router.state.location.search).toEqual({ from: `patients/${DHARTI}/invoices` });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${DHARTI}/invoices`,
      ),
    );
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

  it('turns a create link away for a role without Payments Create, with the permission toast', async () => {
    const { router } = renderInvoicesRoutes(`${BASE}/create`, {
      host: Probe,
      role: 'doctor',
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });

  it('turns a copy link away for a role without Payments Create, the invoice it copies never read', async () => {
    const { router, queryClient } = renderInvoicesRoutes(
      `${BASE}/create?copyOf=${ref.invoice(787)}`,
      { host: Probe, role: 'doctor' },
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: invoiceQueryKeys.detail(ref.invoice(787)) }),
    ).toBeUndefined();
  });
});
