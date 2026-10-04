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

describe('PatientOverviewPage', () => {
  it('renders the Clinical notes section in the patient file', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/overview'));
    expect(await screen.findByTestId('patient-section-overview')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Clinical notes' }),
    ).toBeInTheDocument();
  });
});
