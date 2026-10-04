import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderInvoicesRoutes,
  resetInvoicesRoutes,
} from './__tests__/integration/invoices-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));
vi.mock('@/shared/components/PrintTemplate/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  printDocument: printMock,
}));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const BASE = '/organization/acme/invoices';
const DHARTI = patientRef('Dharti Galani');

const setUser = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The remark on the sheet `printDocument` was handed. */
function printedRemark(): unknown {
  const sheet: unknown = printMock.mock.calls.at(-1)?.[0];
  if (!isValidElement<{ invoice: { remark: string | null } }>(sheet)) return undefined;
  return sheet.props.invoice.remark;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetInvoicesRoutes();
  resetClinicFixtures();
});

describe('InvoicesLayout — the invoice routes over the ledger (KICKOFF §4, §6.9)', () => {
  it('opens New invoice on the link’s type and patient, over the ledger', async () => {
    renderInvoicesRoutes(`${BASE}/create?type=consultation&patient=${DHARTI}`);
    const drawer = await screen.findByTestId('invoice-drawer');
    expect(screen.getByText('ledger behind')).toBeInTheDocument();
    expect(within(drawer).getByRole('radio', { name: 'Consultation' })).toBeChecked();
    await waitFor(() =>
      expect(within(drawer).getByTestId('invoice-drawer-footer')).toHaveTextContent(
        'Consultation · Dharti Galani · 0 items',
      ),
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('previews an invoice on its A4 sheet — the Remark on it — and prints that sheet', async () => {
    const user = setUser();
    const { router } = renderInvoicesRoutes(`${BASE}/${ref.invoice(786)}?from=today`);
    const preview = await screen.findByTestId('invoice-preview');
    expect(within(preview).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Print preview · Consultation invoice #786',
    );
    const sheet = await within(preview).findByTestId('invoice-print');
    expect(within(sheet).getByText('Free first visit')).toBeInTheDocument();
    await user.click(within(preview).getByTestId('invoice-preview-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    expect(printedRemark()).toBe('Free first visit');
    expect(await axeForDialog(preview)).toHaveNoViolations();

    await user.click(within(preview).getByTestId('invoice-preview-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('names a Medical invoice’s preview as one', async () => {
    renderInvoicesRoutes(`${BASE}/${ref.invoice(790)}`);
    const preview = await screen.findByTestId('invoice-preview');
    expect(within(preview).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Print preview · Medical invoice #790',
    );
  });

  it('prints a Remark written in Edit invoice once it is saved (§7.3)', async () => {
    const user = setUser();
    const { router } = renderInvoicesRoutes(`${BASE}/${ref.invoice(787)}/edit`);
    const drawer = await screen.findByTestId('invoice-drawer');
    expect(within(drawer).getByTestId('invoice-drawer-tag')).toHaveTextContent('#787');
    await user.click(within(drawer).getByTestId('invoice-drawer-step-payment-trigger'));
    await user.type(
      within(drawer).getByTestId('invoice-drawer-remark'),
      'Second sitting next week',
    );
    await user.click(within(drawer).getByTestId('invoice-drawer-save'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );

    await router.navigate({ to: `${BASE}/${ref.invoice(787)}` });
    const preview = await screen.findByTestId('invoice-preview');
    const sheet = await within(preview).findByTestId('invoice-print');
    expect(within(sheet).getByText('Second sitting next week')).toBeInTheDocument();
    await user.click(within(preview).getByTestId('invoice-preview-print'));
    expect(printedRemark()).toBe('Second sitting next week');
  });

  it('shows nothing of its own at the bare route — the ledger alone', async () => {
    renderInvoicesRoutes(BASE);
    expect(await screen.findByText('ledger behind')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-drawer')).toBeNull();
    expect(screen.queryByTestId('invoice-preview')).toBeNull();
  });
});
