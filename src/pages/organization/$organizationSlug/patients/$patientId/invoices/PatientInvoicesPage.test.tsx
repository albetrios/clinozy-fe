import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type * as InvoicesApiModule from '@/shared/api/app/invoices-api.ts';
import {
  deleteInvoice,
  fetchInvoiceTotals,
  listInvoices,
  restoreInvoice,
} from '@/shared/api/app/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { patientFile, patientRecord } from '@/tests/utils/patient-doubles.ts';
import { invoiceRecord, TEST_MONEY_PATIENT_ID } from '@/tests/utils/payments-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientInvoicesPage } from './PatientInvoicesPage.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof InvoicesApiModule>()),
  listInvoices: vi.fn(),
  fetchInvoiceTotals: vi.fn(),
  deleteInvoice: vi.fn(),
  restoreInvoice: vi.fn(),
}));

/** #5 — a consultation that still owes ₹100 of ₹500. */
const CONSULTATION = invoiceRecord();
/** #6 — a clinic invoice paid in full. */
const LHR = invoiceRecord({
  id: 'invc_lhrfullface0000000000',
  seq: 6,
  type: 'clinic',
  items: [{ ...invoiceRecord().items[0]!, name: 'LHR Full Face' }],
  total: 4800,
  paid: 4800,
  due: 0,
  status: 'paid',
  remark: null,
  date: '2026-10-09',
});

const FILE = patientFile({ patient: patientRecord({ id: TEST_MONEY_PATIENT_ID }) });
const FROM = `patients/${TEST_MONEY_PATIENT_ID}/invoices`;
const action = (id: string) => `patient-invoices-row-action-${id}`;

/** Her row of an invoice, by its number. */
async function invoiceRow(number: string) {
  const rows = await screen.findAllByTestId('patient-invoices-table-row');
  const row = rows.find((candidate) => within(candidate).queryAllByText(number).length);
  if (!row) throw new Error(`no row ${number}`);
  return row;
}

/** An invoice's row action, once the member's access has answered. */
function rowAction(number: string, id: string) {
  return waitFor(async () => within(await invoiceRow(number)).getByTestId(action(id)));
}

/** The section on the API's answers: her invoices on one page, and the server's totals. */
function answer(
  rows: InvoiceRecord[],
  totals: { due: number; paid: number; count?: number } | null,
) {
  vi.mocked(listInvoices).mockResolvedValue({
    rows,
    next: null,
    total: rows.length,
    totals,
  });
  vi.mocked(fetchInvoiceTotals).mockResolvedValue(totals);
}

/** The section in the file — the Admin's View-as preview, or a member holding `codes`. */
function renderSection(codes?: readonly OrganizationPermission[]) {
  const view = renderInPatientFile(<PatientInvoicesPage />, {
    file: FILE,
    section: 'invoices',
  });
  if (codes) {
    act(() => {
      useUIStore.setState({ previewRole: null });
      useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
    });
  }
  return view;
}

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  for (const fn of [listInvoices, fetchInvoiceTotals, deleteInvoice, restoreInvoice]) {
    vi.mocked(fn).mockReset();
  }
  answer([CONSULTATION, LHR], { due: 100, paid: 5200, count: 2 });
});
afterEach(() => resetPatientFile());

describe('PatientInvoicesPage', () => {
  it('lists her invoices with the server’s bill, paid, due and status (H:4748)', async () => {
    const { container } = renderSection();
    expect(await screen.findByTestId('patient-section-invoices')).toBeInTheDocument();
    const consultation = await invoiceRow('#5');
    expect(within(consultation).getAllByText('Consultation').length).toBeGreaterThan(0);
    expect(within(consultation).getByText('Paid at the desk')).toBeInTheDocument();
    expect(within(consultation).getAllByText('₹100 due').length).toBeGreaterThan(0);
    expect(within(consultation).getAllByText('Partly paid').length).toBeGreaterThan(0);
    const lhr = await invoiceRow('#6');
    expect(within(lhr).getAllByText('₹4,800').length).toBeGreaterThan(0);
    expect(within(lhr).getAllByText('Nothing due').length).toBeGreaterThan(0);
    expect(listInvoices).toHaveBeenCalledWith(
      { patientId: TEST_MONEY_PATIENT_ID },
      undefined,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('counts her invoices and what she owes from the server’s totals, never the rows', async () => {
    answer([CONSULTATION], { due: 4900, paid: 5200, count: 60 });
    vi.mocked(listInvoices).mockResolvedValue({
      rows: [CONSULTATION],
      next: 'cur_2',
      total: 60,
      totals: null,
    });
    renderSection();
    expect(await screen.findByText('60 invoices · ₹4,900 due')).toBeInTheDocument();
    expect(fetchInvoiceTotals).toHaveBeenCalledWith({ patientId: TEST_MONEY_PATIENT_ID });
  });

  it('says only how many when she owes nothing', async () => {
    answer([LHR], { due: 0, paid: 4800, count: 1 });
    renderSection();
    expect(await screen.findByText('1 invoice')).toBeInTheDocument();
  });

  it('says so when the patient has no invoices', async () => {
    answer([], { due: 0, paid: 0, count: 0 });
    renderSection();
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
  });

  it('says the read failed, in place, and reads again on Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(listInvoices).mockRejectedValueOnce(
      new HttpError('Server error', 500, '/app/invoices', 'GET'),
    );
    renderSection();
    await user.click(await screen.findByTestId('retry-button'));
    expect(await invoiceRow('#5')).toBeInTheDocument();
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('records a payment for an invoice that owes, keeping the section behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderSection();
    const consultation = await invoiceRow('#5');
    await user.click(within(consultation).getByTestId(action('pay')));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/payments/receive'),
    );
    expect(shownLocation(router).search).toEqual({
      patient: TEST_MONEY_PATIENT_ID,
      invoice: CONSULTATION.id,
      from: FROM,
    });
    const lhr = await invoiceRow('#6');
    expect(within(lhr).queryByTestId(action('pay'))).not.toBeInTheDocument();
  });

  it('opens Edit invoice from a row by its public id, the section kept behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderSection();
    await user.click(within(await invoiceRow('#6')).getByText('LHR Full Face'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        `/organization/acme/invoices/${LHR.id}/edit`,
      ),
    );
    expect(shownLocation(router).search).toEqual({ from: FROM });
  });

  it('asks before deleting an invoice, deletes it with the reason and offers Undo', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteInvoice).mockResolvedValue(undefined);
    renderSection(['payment:read', 'payment:update', 'payment:delete']);
    await user.click(await rowAction('#6', 'delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('#6');
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(deleteInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: LHR.id }),
      ),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(expect.stringContaining('#6'), {
        onUndo: expect.any(Function),
      }),
    );
  });

  it('keeps the writes to their codes: a reader prints and previews only', async () => {
    renderSection(['payment:read']);
    await waitFor(async () =>
      expect(
        within(await invoiceRow('#5')).queryByTestId(action('edit')),
      ).not.toBeInTheDocument(),
    );
    const row = await invoiceRow('#5');
    expect(within(row).getByTestId(action('print'))).toBeInTheDocument();
    expect(within(row).getByTestId(action('preview'))).toBeInTheDocument();
    for (const id of ['copy', 'pay', 'delete']) {
      expect(within(row).queryByTestId(action(id))).not.toBeInTheDocument();
    }
  });
});
