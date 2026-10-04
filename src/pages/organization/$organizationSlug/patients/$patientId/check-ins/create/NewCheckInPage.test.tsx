import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../__tests__/integration/patient-file-test-router.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const DHARTI = patientRef('Dharti Galani');

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('NewCheckInPage (S:44)', () => {
  it('shows the section it came from with a new check-in over it', async () => {
    renderPatientFile(`${patientFileUrl(DHARTI, '/check-ins/create')}?from=images`, {
      role: 'doctor',
    });
    expect(await screen.findByTestId('check-in-drawer-title')).toHaveTextContent(
      'Visit check-in',
    );
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
    expect(clinicFixtures.checkIns.snapshot(() => true).length).toBeGreaterThan(0);
  });
});
