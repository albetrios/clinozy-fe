import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoice: vi.fn(),
  fetchInvoicePresets: vi.fn(),
  fetchInvoiceTotals: vi.fn(),
  previewInvoice: vi.fn(),
  previewInvoiceChange: vi.fn(),
  updateInvoice: vi.fn(),
}));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(),
  fetchAllOffers: vi.fn(),
}));
vi.mock('@/shared/api/clinic/plan-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPlan: vi.fn(),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));

import * as branchesApi from '@/shared/api/clinic/branches-api.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import {
  fetchInvoice,
  fetchInvoicePresets,
  fetchInvoiceTotals,
  previewInvoice,
  previewInvoiceChange,
  updateInvoice,
} from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceDetail } from '@/shared/api/clinic/invoices-contracts.ts';
import { fetchAllOfferings, fetchAllOffers } from '@/shared/api/clinic/offerings-api.ts';
import { fetchPatient } from '@/shared/api/clinic/patients-api.ts';
import { fetchPlan } from '@/shared/api/clinic/plan-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  INVOICE_TEST_BRANCHES,
  INVOICE_TEST_OFFERINGS,
  INVOICE_TEST_OFFERS,
  INVOICE_TEST_TEAM,
  invoiceDetail,
  invoicePreview,
} from '@/tests/utils/invoice-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';
import {
  invoiceRecord,
  TEST_INVOICE_ID,
  TEST_MONEY_AUTHOR_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
} from '@/tests/utils/payments-doubles.ts';

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

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const BASE = '/organization/acme/invoices';
const KAVYA = TEST_MONEY_PATIENT_ID;

const setUser = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** The remark on the sheet `printDocument` was handed. */
function printedRemark(): unknown {
  const sheet: unknown = printMock.mock.calls.at(-1)?.[0];
  if (!isValidElement<{ invoice: { remark: string | null } }>(sheet)) return undefined;
  return sheet.props.invoice.remark;
}

/** Invoice #5 as the server keeps it — a save changes it. */
let stored: InvoiceDetail = invoiceDetail();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockReset();
  printMock.mockResolvedValue(undefined);
  stored = invoiceDetail();
  vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue(INVOICE_TEST_BRANCHES);
  vi.mocked(fetchAllOfferings).mockResolvedValue(INVOICE_TEST_OFFERINGS);
  vi.mocked(fetchAllOffers).mockResolvedValue(INVOICE_TEST_OFFERS);
  vi.mocked(fetchTeamDirectory).mockResolvedValue(INVOICE_TEST_TEAM);
  vi.mocked(findMyMembershipId).mockResolvedValue(TEST_MONEY_AUTHOR_ID);
  vi.mocked(fetchPlan).mockResolvedValue({ suggestions: [], planTotal: 0 });
  vi.mocked(fetchInvoicePresets).mockResolvedValue({
    packages: [],
    lastByType: {},
    recentTeamIds: [],
  });
  vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 100, paid: 400 });
  vi.mocked(fetchPatient).mockResolvedValue(
    patientRecord({
      id: KAVYA,
      contactId: TEST_MONEY_CONTACT_ID,
      name: 'Kavya Mehta',
      firstName: 'Kavya',
      lastName: 'Mehta',
    }),
  );
  vi.mocked(fetchInvoice).mockImplementation(async (id) => {
    if (id !== TEST_INVOICE_ID) {
      throw new HttpError('not found', 404, `/app/invoices/${id}`, 'GET', {});
    }
    return stored;
  });
  const consultation = (paid: number) =>
    invoicePreview(
      [
        {
          id: stored.invoice.items[0]?.id ?? null,
          offeringId: 'off_3f4nzxf53tfyf9k6hlna1',
          name: 'Consultation',
          qty: 1,
          rate: 500,
          gstPct: 0,
        },
      ],
      { type: 'consultation', paid, due: 500 - paid },
    );
  vi.mocked(previewInvoice).mockImplementation(async () => consultation(0));
  vi.mocked(previewInvoiceChange).mockImplementation(async () => consultation(400));
  vi.mocked(updateInvoice).mockImplementation(async ({ invoice, input }) => {
    stored = invoiceDetail({ ...invoice, remark: input.remark });
    return { detail: stored, planLinked: 0 };
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetInvoicesRoutes();
});

describe('InvoicesLayout — the invoice routes over the ledger (KICKOFF §4, §6.9)', () => {
  it('opens New invoice on the link’s type and patient, over the ledger', async () => {
    renderInvoicesRoutes(`${BASE}/create?type=consultation&patient=${KAVYA}`);
    const drawer = await screen.findByTestId('invoice-drawer');
    expect(screen.getByText('ledger behind')).toBeInTheDocument();
    expect(within(drawer).getByRole('radio', { name: 'Consultation' })).toBeChecked();
    await waitFor(() =>
      expect(within(drawer).getByTestId('invoice-drawer-footer')).toHaveTextContent(
        'Consultation · Kavya Mehta · 0 items',
      ),
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('opens a copy of an invoice once it is read: its lines and party, nothing paid (Copy invoice)', async () => {
    renderInvoicesRoutes(
      `${BASE}/create?type=consultation&patient=${KAVYA}&copyOf=${TEST_INVOICE_ID}`,
    );
    const drawer = await screen.findByTestId('invoice-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('invoice-drawer-footer')).toHaveTextContent(
        'Kavya Mehta · 1 item',
      ),
    );
    expect(within(drawer).getByTestId('invoice-drawer-title')).toHaveTextContent(
      'New invoice',
    );
    // #5's ₹500, none of it paid on the copy.
    await waitFor(() =>
      expect(within(drawer).getByTestId('invoice-drawer-totals-bill')).toHaveTextContent(
        '₹500',
      ),
    );
    expect(within(drawer).getByTestId('invoice-drawer-totals-due')).toHaveTextContent(
      '₹500',
    );
  });

  it('previews an invoice on its A4 sheet — its statutory number and Remark — and prints that sheet', async () => {
    const user = setUser();
    const { router } = renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}?from=today`);
    const preview = await screen.findByTestId('invoice-preview');
    expect(within(preview).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Print preview · Consultation invoice #5',
    );
    const sheet = await within(preview).findByTestId('invoice-print');
    expect(within(sheet).getByText('Paid at the desk')).toBeInTheDocument();
    expect(within(sheet).getByText('2026-27/0005')).toBeInTheDocument();
    await user.click(within(preview).getByTestId('invoice-preview-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    expect(printedRemark()).toBe('Paid at the desk');
    expect(await axeForDialog(preview)).toHaveNoViolations();

    await user.click(within(preview).getByTestId('invoice-preview-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('names a Medical invoice’s preview as one', async () => {
    stored = invoiceDetail(invoiceRecord({ type: 'medical' }));
    renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}`);
    const preview = await screen.findByTestId('invoice-preview');
    expect(within(preview).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Print preview · Medical invoice #5',
    );
  });

  it('prints a Remark written in Edit invoice once it is saved (§7.3)', async () => {
    const user = setUser();
    const { router } = renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}/edit`);
    // The skeleton's shell first, then the invoice as read.
    expect(await screen.findByTestId('invoice-drawer-tag')).toHaveTextContent('#5');
    const drawer = screen.getByTestId('invoice-drawer');
    await user.click(within(drawer).getByTestId('invoice-drawer-step-payment-trigger'));
    const remark = within(drawer).getByTestId('invoice-drawer-remark');
    await user.clear(remark);
    await user.type(remark, 'Second sitting next week');
    await user.click(within(drawer).getByTestId('invoice-drawer-save'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );

    await router.navigate({ to: `${BASE}/${TEST_INVOICE_ID}` });
    const preview = await screen.findByTestId('invoice-preview');
    const sheet = await within(preview).findByTestId('invoice-print');
    expect(within(sheet).getByText('Second sitting next week')).toBeInTheDocument();
    await user.click(within(preview).getByTestId('invoice-preview-print'));
    expect(printedRemark()).toBe('Second sitting next week');
  });

  it('shows the drawer’s skeleton while an invoice loads, and Retry when the read fails', async () => {
    const user = setUser();
    vi.mocked(fetchInvoice).mockRejectedValue(
      new HttpError('down', 503, '/app/invoices', 'GET', {}),
    );
    renderInvoicesRoutes(`${BASE}/${TEST_INVOICE_ID}/edit`);
    expect(await screen.findByTestId('invoice-drawer-skeleton')).toBeInTheDocument();
    const retry = await screen.findByTestId('retry-button', {}, { timeout: 8000 });
    vi.mocked(fetchInvoice).mockResolvedValue(stored);
    await user.click(retry);
    expect(await screen.findByTestId('invoice-drawer-tag')).toHaveTextContent('#5');
  });

  it('shows nothing of its own at the bare route — the ledger alone', async () => {
    renderInvoicesRoutes(BASE);
    expect(await screen.findByText('ledger behind')).toBeInTheDocument();
    expect(screen.queryByTestId('invoice-drawer')).toBeNull();
    expect(screen.queryByTestId('invoice-preview')).toBeNull();
  });
});
