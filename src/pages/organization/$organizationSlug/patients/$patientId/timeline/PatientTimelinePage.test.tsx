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

describe('PatientTimelinePage', () => {
  it('renders the Overview section in the patient file', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/timeline'));
    expect(await screen.findByTestId('patient-section-timeline')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Overview' }),
    ).toBeInTheDocument();
  });

  it('shows the bento, then the activity timeline, without a section header (H:4943)', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/timeline'));
    const bento = await screen.findByTestId('overview-bento');
    const activity = screen.getByTestId('overview-activity');
    expect(
      bento.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toHaveClass(
      'sr-only',
    );
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
  });
});
