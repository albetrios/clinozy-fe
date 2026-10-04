import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

const DHARTI = patientRef('Dharti Galani');

beforeEach(() => resetClinicFixtures());
afterEach(() => resetPatientFile());

describe('PatientPrescriptionsPage', () => {
  it('renders the Prescriptions section in the patient file', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/prescriptions'));
    expect(
      await screen.findByTestId('patient-section-prescriptions'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Prescriptions' }),
    ).toBeInTheDocument();
  });
});
