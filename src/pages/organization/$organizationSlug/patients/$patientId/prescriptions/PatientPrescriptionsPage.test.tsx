import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  prescriptionLine,
  prescriptionRecord,
  resetRxWorld,
  rxServerApi,
  rxWorld,
  TEST_PRESCRIPTION_ID,
} from './__tests__/integration/prescription-doubles.ts';
import {
  prescriptionsUrl,
  renderPrescriptions,
  resetPrescriptionsMember,
} from './__tests__/integration/prescriptions-test-router.tsx';

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

vi.mock('@/shared/api/clinic/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('./__tests__/integration/prescription-doubles.ts')).rxServerApi,
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { DOCTOR_ARJUN, DOCTOR_NISHA } =
    await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA, DOCTOR_ARJUN]),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => 'mem_nisha0000000000000000'),
}));

const url = prescriptionsUrl;
const action = (id: string) => `patient-prescriptions-row-action-${id}`;
/** Rx #499, approved. */
const APPROVED = prescriptionRecord({
  id: 'rx_rx49900000000000000000',
  seq: 499,
  date: '2026-09-20',
  status: 'approved',
  approvedAt: '2026-09-20T06:00:00.000Z',
  items: [
    prescriptionLine({
      medicineName: 'Sunscreen SPF 50',
      doseMorning: 1,
      doseAfternoon: 1,
      doseNight: 0,
      meal: null,
      timing: 'morning',
      qty: 1,
    }),
  ],
});

/** The table's rows. */
const rows = () => screen.findAllByTestId('patient-prescriptions-table-row');

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  for (const fn of Object.values(rxServerApi)) fn.mockClear();
  resetRxWorld({ prescriptions: [prescriptionRecord(), APPROVED] });
});
afterEach(() => resetPrescriptionsMember());

describe('PatientPrescriptionsPage', () => {
  it('lists her prescriptions newest first — the number, the medicines over their directions, the status', async () => {
    const { container } = renderPrescriptions(url(''));
    expect(
      await screen.findByTestId('patient-section-prescriptions'),
    ).toBeInTheDocument();
    const [draft, approved] = await rows();
    if (!(draft && approved)) throw new Error('no rows');
    expect(within(draft).getAllByText('#500').length).toBeGreaterThan(0);
    expect(within(draft).getByText('Flubolt 400')).toBeInTheDocument();
    expect(within(draft).getByText('0-0-1 · After meal')).toBeInTheDocument();
    expect(within(draft).getAllByText('Draft').length).toBeGreaterThan(0);
    expect(within(approved).getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getByText('2 prescriptions')).toBeInTheDocument();
    expect(rxServerApi.listPatientPrescriptions).toHaveBeenCalledWith(TEST_PATIENT_ID);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says so when the patient has none', async () => {
    resetRxWorld();
    renderPrescriptions(url(''));
    expect(await screen.findByText('No prescriptions yet')).toBeInTheDocument();
  });

  it('shows a failed read in place, with Retry', async () => {
    const user = userEvent.setup();
    rxServerApi.listPatientPrescriptions.mockRejectedValueOnce(
      new HttpError('Server error', 500, '/app/patients/…/prescriptions', 'GET'),
    );
    renderPrescriptions(url(''));
    await user.click(await screen.findByTestId('retry-button'));
    expect(await rows()).toHaveLength(2);
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('opens Edit prescription from a row', async () => {
    const user = userEvent.setup();
    const { router } = renderPrescriptions(url(''));
    await screen.findAllByText('Nisha S.');
    // A read that lands late re-renders the rows under the click: click the row as it stands
    // until the drawer's route opens.
    await waitFor(async () => {
      const [row] = await rows();
      if (!row) throw new Error('no row');
      await user.click(within(row).getByText('Flubolt 400'));
      expect(router.state.location.pathname).toBe(url(`/${TEST_PRESCRIPTION_ID}/edit`));
    });
    expect(await screen.findByTestId('rx-drawer')).toBeInTheDocument();
  });

  it('prints a row’s sheet and copies it as today’s draft', async () => {
    const user = userEvent.setup();
    renderPrescriptions(url(''));
    await rows();
    const [print] = screen.getAllByTestId(action('print'));
    if (!print) throw new Error('no print');
    await user.click(print);
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    expect(rxServerApi.fetchRxSheetClinic).toHaveBeenCalled();

    const [copy] = screen.getAllByTestId(action('copy'));
    if (!copy) throw new Error('no copy');
    await user.click(copy);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription copied'),
    );
    expect(await rows()).toHaveLength(3);
    expect(rxServerApi.approvePrescription).not.toHaveBeenCalled();
  });

  it('sells an approved prescription’s medicines in a new sale', async () => {
    const user = userEvent.setup();
    const { router } = renderPrescriptions(url(''));
    await rows();
    // Only the approved one sells: a sale fills an approved prescription.
    const sells = screen.getAllByTestId(action('sell'));
    expect(sells).toHaveLength(1);
    await user.click(sells[0] as HTMLElement);
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/medical/sales/create',
      ),
    );
    expect(shownLocation(router).search).toEqual({
      prescription: APPROVED.id,
      from: `patients/${TEST_PATIENT_ID}/prescriptions`,
    });
  });

  it('deletes a draft with the reason the confirm picks and offers Undo', async () => {
    const user = userEvent.setup();
    resetRxWorld({ prescriptions: [prescriptionRecord()] });
    renderPrescriptions(url(''));
    await user.click(await screen.findByTestId(action('delete')));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this prescription?')).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    expect(await screen.findByText('No prescriptions yet')).toBeInTheDocument();
    expect(rxServerApi.deletePrescription).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'duplicate', note: null }),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Prescription deleted', {
      onUndo: expect.any(Function),
    });
  });

  it('gives a member without the Rx gate the reading actions only', async () => {
    renderPrescriptions(url(''), { member: { role: 'front_desk' } });
    await rows();
    expect(screen.getAllByTestId(action('print')).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(action('preview')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId(action('copy'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('edit'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('delete'))).not.toBeInTheDocument();
  });

  it('opens New prescription over the section for a member who writes (S:35)', async () => {
    renderPrescriptions(url('/create'), {
      member: { codes: ['patient_prescription:read', 'patient_prescription:create'] },
    });
    const drawer = await screen.findByTestId('rx-drawer');
    expect(within(drawer).getByTestId('rx-drawer-title')).toHaveTextContent(
      'New prescription',
    );
    expect(screen.getByTestId('patient-section-prescriptions')).toBeInTheDocument();
  });

  it('turns a member without the Rx gate back with the permission toast', async () => {
    const { router } = renderPrescriptions(url('/create'), {
      member: { role: 'front_desk' },
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('rx-drawer')).not.toBeInTheDocument();
  });

  it('shows a prescription’s print preview — the sheet the browser prints (S:36)', async () => {
    const user = userEvent.setup();
    const { router, baseElement } = renderPrescriptions(url(`/${APPROVED.id}`));
    const preview = await screen.findByTestId('rx-print-preview');
    expect(within(preview).getByText('Print preview · Prescription #499')).toBeVisible();
    const sheet = await within(preview).findByTestId('prescription-print');
    expect(sheet).toHaveTextContent('Sunscreen SPF 50');
    expect(sheet).toHaveTextContent('Priya Shah');
    expect(sheet).toHaveTextContent(rxWorld.clinic.organization.name);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
    await user.click(within(preview).getByTestId('rx-print-preview-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    await user.click(within(preview).getByTestId('rx-print-preview-close'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
  });

  it('goes back to the section when the prescription is gone', async () => {
    const { router } = renderPrescriptions(url('/rx_gone0000000000000000/edit'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Prescription not found · it may have been deleted',
    );
  });
});
