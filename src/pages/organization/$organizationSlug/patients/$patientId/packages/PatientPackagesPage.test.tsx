import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

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

const DHARTI = patientRef('Dharti Galani');
/** Dharti's LHR Full Face · B4G7 package: 1 of 7 used. */
const LHR = ref.patientPackage(1);
const url = () => patientFileUrl(DHARTI, '/packages');
const card = () => screen.findByTestId(`patient-package-${LHR}`);

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientPackagesPage', () => {
  it('renders the Packages section in the patient file', async () => {
    renderPatientFile(url());
    expect(await screen.findByTestId('patient-section-packages')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Packages' }),
    ).toBeInTheDocument();
  });

  it('shows each package — what is left, what is used, until when (H:833)', async () => {
    renderPatientFile(url());
    const lhr = await card();
    expect(within(lhr).getByText('LHR Full Face · B4G7')).toBeInTheDocument();
    expect(within(lhr).getByText('6 left')).toBeInTheDocument();
    expect(within(lhr).getByText('1 of 7 used')).toBeInTheDocument();
    expect(within(lhr).getByText(/^Valid till /)).toBeInTheDocument();
  });

  it('uses a session by hand', async () => {
    const user = userEvent.setup();
    renderPatientFile(url());
    await user.click(await screen.findByTestId(`patient-package-${LHR}-use`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 of 7 used'),
    );
    expect(await within(await card()).findByText('5 left')).toBeInTheDocument();
  });

  it('says so when no session is left', async () => {
    const user = userEvent.setup();
    await clinicFixtures.patientPackages.update(LHR, { sessionsUsed: 7 });
    renderPatientFile(url());
    expect(within(await card()).getByText('0 left')).toBeInTheDocument();
    await user.click(screen.getByTestId(`patient-package-${LHR}-use`));
    expect(notifyMock.info).toHaveBeenCalledWith('No sessions left');
  });

  it('books the next visit for her, keeping the section behind the form', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url());
    await user.click(await screen.findByTestId(`patient-package-${LHR}-book`));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(router.state.location.search).toEqual({
      who: DHARTI,
      from: `patients/${DHARTI}/packages`,
    });
  });

  it('leaves a member who only reads the file the cards alone', async () => {
    renderPatientFile(url(), { role: 'therapist' });
    expect(await card()).toBeInTheDocument();
    expect(screen.queryByTestId(`patient-package-${LHR}-use`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`patient-package-${LHR}-book`)).not.toBeInTheDocument();
  });

  it('says so when the patient has no packages', async () => {
    renderPatientFile(patientFileUrl(patientRef('Kavya Joshi'), '/packages'));
    expect(await screen.findByText('No packages yet')).toBeInTheDocument();
  });
});
