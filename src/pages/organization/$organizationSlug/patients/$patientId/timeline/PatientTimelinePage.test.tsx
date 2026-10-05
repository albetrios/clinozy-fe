import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { startVisit } from '@/shared/api/clinic/visits-api.ts';

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

  it('shows the visit flow in its place on `?visit=open` while a visit is open (L-49)', async () => {
    await startVisit({ patientId: DHARTI });
    renderPatientFile(patientFileUrl(DHARTI, '/timeline?visit=open'));
    expect(await screen.findByTestId('visit-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('overview-bento')).not.toBeInTheDocument();
  });

  it('drops a `?visit=open` with no open visit and keeps the Overview — a link never starts one', async () => {
    const { router } = renderPatientFile(patientFileUrl(DHARTI, '/timeline?visit=open'));
    expect(await screen.findByTestId('overview-bento')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/timeline'));
    expect(screen.queryByTestId('visit-flow')).not.toBeInTheDocument();
  });
});
