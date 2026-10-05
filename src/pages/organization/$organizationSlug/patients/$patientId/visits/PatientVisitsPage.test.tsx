import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const DHARTI = patientRef('Dharti Galani');

beforeEach(() => resetClinicFixtures());
afterEach(() => resetPatientFile());

describe('PatientVisitsPage', () => {
  it('renders the Visits section in the patient file', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    expect(await screen.findByTestId('patient-section-visits')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Visits' })).toBeInTheDocument();
  });

  it('lists her appointments with their status (H:4746)', async () => {
    renderPatientFile(patientFileUrl(DHARTI, '/visits'));
    const rows = await screen.findAllByTestId('patient-visits-table-row');
    expect(rows.length).toBeGreaterThan(1);
    const table = screen.getByTestId('patient-visits-table');
    expect(within(table).getAllByText('#2859').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getByText(`${rows.length} appointments`)).toBeInTheDocument();
    expect(screen.getByText('All appointments loaded')).toBeInTheDocument();
    // The Columns chooser sits in the section header.
    expect(screen.getByTestId('patient-visits-columns-trigger')).toBeInTheDocument();
  });

  it('says so when the patient has no appointments', async () => {
    renderPatientFile(patientFileUrl(patientRef('Kavya Joshi'), '/visits'));
    expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
  });
});
