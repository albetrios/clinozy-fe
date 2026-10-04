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

describe('PatientVisitsPage', () => {
  it('renders the Visits section in the patient file', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    expect(await screen.findByTestId('patient-section-visits')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Visits' })).toBeInTheDocument();
  });
});
