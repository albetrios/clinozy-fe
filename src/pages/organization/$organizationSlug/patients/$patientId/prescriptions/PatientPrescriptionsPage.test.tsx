import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
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
/** Dharti's Rx #497 (Sunscreen SPF 50). */
const RX_497 = ref.prescription(497);
const url = (rest: string) => patientFileUrl(DHARTI, `/prescriptions${rest}`);
const action = (id: string) => `patient-prescriptions-row-action-${id}`;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientPrescriptionsPage', () => {
  it('renders the Prescriptions section in the patient file', async () => {
    renderPatientFile(url(''));
    expect(
      await screen.findByTestId('patient-section-prescriptions'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Prescriptions' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('rx-drawer')).not.toBeInTheDocument();
  });

  it('lists her prescriptions — the number, the medicines over their directions (H:4753)', async () => {
    renderPatientFile(url(''));
    const [row] = await screen.findAllByTestId('patient-prescriptions-table-row');
    if (!row) throw new Error('no row');
    expect(within(row).getAllByText('#497').length).toBeGreaterThan(0);
    expect(within(row).getByText('Sunscreen SPF 50')).toBeInTheDocument();
    expect(within(row).getByText('1-1-0 · Morning')).toBeInTheDocument();
    expect(screen.getByText('1 prescription')).toBeInTheDocument();
    expect(screen.getByText('All prescriptions loaded')).toBeInTheDocument();
  });

  it('opens Edit prescription from a row', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(''));
    const [row] = await screen.findAllByTestId('patient-prescriptions-table-row');
    if (!row) throw new Error('no row');
    await user.click(within(row).getByText('Sunscreen SPF 50'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(url(`/${RX_497}/edit`)),
    );
    expect(await screen.findByTestId('rx-drawer')).toBeInTheDocument();
  });

  it('prints the sheet, opens the preview and copies the prescription from its actions', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(''));
    await user.click(await screen.findByTestId(action('print')));
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByTestId(action('copy')));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription copied'),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('patient-prescriptions-table-row')).toHaveLength(2),
    );

    const [first] = screen.getAllByTestId(action('preview'));
    if (!first) throw new Error('no preview');
    await user.click(first);
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/\/prescriptions\/[\w-]+$/),
    );
    expect(await screen.findByTestId('rx-print-preview')).toBeInTheDocument();
  });

  it('sells the medicines in a new sale, keeping the section behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(''));
    await user.click(await screen.findByTestId(action('sell')));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/medical/sales/create',
      ),
    );
    expect(shownLocation(router).search).toEqual({
      prescription: RX_497,
      from: `patients/${DHARTI}/prescriptions`,
    });
    expect(router.state.location.pathname).toBe(url(''));
  });

  it('asks before deleting a prescription and offers Undo', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(''));
    await user.click(await screen.findByTestId(action('delete')));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this prescription?')).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    expect(await screen.findByText('No prescriptions yet')).toBeInTheDocument();
    expect(notifyMock.undo).toHaveBeenCalledWith('Prescription deleted', {
      onUndo: expect.any(Function),
    });
  });

  it('gives a member without the Rx gate the reading actions only', async () => {
    renderPatientFile(url(''), { role: 'front_desk' });
    expect(await screen.findByTestId(action('print'))).toBeInTheDocument();
    expect(screen.getByTestId(action('preview'))).toBeInTheDocument();
    expect(screen.queryByTestId(action('copy'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('edit'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('delete'))).not.toBeInTheDocument();
  });

  it('opens New prescription over the section for a doctor (S:35)', async () => {
    renderPatientFile(url('/create'), { role: 'doctor' });
    const drawer = await screen.findByTestId('rx-drawer');
    expect(within(drawer).getByTestId('rx-drawer-title')).toHaveTextContent(
      'New prescription',
    );
    expect(screen.getByTestId('patient-section-prescriptions')).toBeInTheDocument();
  });

  it('turns a member without the Rx gate back with the permission toast', async () => {
    const { router } = renderPatientFile(url('/create'), { role: 'front_desk' });
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('rx-drawer')).not.toBeInTheDocument();
  });

  it('shows a prescription’s print preview and prints its sheet (S:36)', async () => {
    const user = userEvent.setup();
    const { router, baseElement } = renderPatientFile(url(`/${RX_497}`));
    const preview = await screen.findByTestId('rx-print-preview');
    expect(within(preview).getByText('Print preview · Prescription #497')).toBeVisible();
    expect(await within(preview).findByTestId('prescription-print')).toHaveTextContent(
      'Sunscreen SPF 50',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
    await user.click(within(preview).getByTestId('rx-print-preview-print'));
    expect(printMock).toHaveBeenCalledTimes(1);
    await user.click(within(preview).getByTestId('rx-print-preview-close'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
  });

  it('goes back to the section when the prescription is gone', async () => {
    const { router } = renderPatientFile(url(`/${ref.prescription(1)}/edit`));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Prescription not found · it may have been deleted',
    );
  });
});
