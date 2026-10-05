import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

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

const DHARTI = patientRef('Dharti Galani');
/** Dharti's Rx #497 (Sunscreen SPF 50). */
const RX_497 = ref.prescription(497);
const url = (rest: string) => patientFileUrl(DHARTI, `/prescriptions${rest}`);

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
