import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

const { notifyMock, printMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  printMock: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/components/PrintTemplate/print-document.ts', () => ({
  printDocument: printMock,
  PRINTING_ATTRIBUTE: 'data-printing',
}));

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const DHARTI = patientRef('Dharti Galani');
const url = (rest = '') => patientFileUrl(DHARTI, `/invoices${rest}`);
const FROM = `patients/${DHARTI}/invoices`;
const action = (id: string) => `patient-invoices-row-action-${id}`;

/** Her row of an invoice, by its number. */
async function invoiceRow(number: string) {
  const rows = await screen.findAllByTestId('patient-invoices-table-row');
  const row = rows.find((candidate) => within(candidate).queryAllByText(number).length);
  if (!row) throw new Error(`no row ${number}`);
  return row;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientInvoicesPage', () => {
  it('renders the Invoices section in the patient file', async () => {
    renderPatientFile(url());
    expect(await screen.findByTestId('patient-section-invoices')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Invoices' }),
    ).toBeInTheDocument();
  });

  it('lists her invoices with the bill, what is paid and due, and the status (H:4748)', async () => {
    renderPatientFile(url());
    const lhr = await invoiceRow('#787');
    expect(within(lhr).getByText('LHR Full Face · B4G7')).toBeInTheDocument();
    expect(within(lhr).getAllByText('Clinic').length).toBeGreaterThan(0);
    expect(within(lhr).getAllByText('₹4,800 due').length).toBeGreaterThan(0);
    expect(within(lhr).getAllByText('Due').length).toBeGreaterThan(0);
    const consultation = await invoiceRow('#786');
    expect(within(consultation).getByText('Free first visit')).toBeInTheDocument();
    expect(within(consultation).getAllByText('Nothing due').length).toBeGreaterThan(0);
    expect(screen.getByText(/^4 invoices · ₹[\d,]+ due$/)).toBeInTheDocument();
  });

  it('records a payment for an invoice that owes, keeping the section behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url());
    const lhr = await invoiceRow('#787');
    await user.click(within(lhr).getByTestId(action('pay')));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/payments/receive'),
    );
    expect(shownLocation(router).search).toEqual({
      patient: DHARTI,
      invoice: ref.invoice(787),
      from: FROM,
    });
    expect(router.state.location.pathname).toBe(url());
  });

  it('opens Edit invoice from a row and the preview from its action', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url());
    const consultation = await invoiceRow('#786');
    expect(within(consultation).queryByTestId(action('pay'))).not.toBeInTheDocument();
    await user.click(within(consultation).getByText('Free first visit'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        `/organization/acme/invoices/${ref.invoice(786)}/edit`,
      ),
    );
    expect(shownLocation(router).search).toEqual({ from: FROM });
    router.history.back();
    const again = await invoiceRow('#786');
    await user.click(within(again).getByTestId(action('preview')));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        `/organization/acme/invoices/${ref.invoice(786)}`,
      ),
    );
  });

  it('prints an invoice’s sheet from its row', async () => {
    const user = userEvent.setup();
    renderPatientFile(url());
    const lhr = await invoiceRow('#787');
    await user.click(within(lhr).getByTestId(action('print')));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });

  it('asks before deleting an invoice and offers Undo', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(), { role: 'owner' });
    const lhr = await invoiceRow('#787');
    await user.click(within(lhr).getByTestId(action('delete')));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this invoice?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Invoice #787',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(screen.getAllByTestId('patient-invoices-table-row')).toHaveLength(3),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Invoice #787 deleted', {
      onUndo: expect.any(Function),
    });
  });

  it('never deletes a Medical sale’s invoice from the file', async () => {
    renderPatientFile(url(), { role: 'owner' });
    const sale = await invoiceRow('#788');
    expect(within(sale).queryByTestId(action('delete'))).not.toBeInTheDocument();
    expect(within(sale).getByTestId(action('edit'))).toBeInTheDocument();
  });

  it('keeps Delete from a member without the void ability', async () => {
    renderPatientFile(url(), { role: 'front_desk' });
    const lhr = await invoiceRow('#787');
    for (const id of ['print', 'preview', 'pay', 'edit']) {
      expect(within(lhr).getByTestId(action(id))).toBeInTheDocument();
    }
    expect(within(lhr).queryByTestId(action('delete'))).not.toBeInTheDocument();
  });

  it('says so when the patient has no invoices', async () => {
    renderPatientFile(patientFileUrl(patientRef('Kavya Joshi'), '/invoices'));
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
  });
});
