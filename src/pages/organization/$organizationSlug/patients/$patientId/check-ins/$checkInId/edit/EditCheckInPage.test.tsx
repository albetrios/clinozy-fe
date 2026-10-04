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
} from '../../../__tests__/integration/patient-file-test-router.tsx';

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

describe('EditCheckInPage (S:45)', () => {
  it('opens the check-in prefilled over Clinical notes', async () => {
    const [saved] = clinicFixtures.checkIns.snapshot((row) => row.patientId === DHARTI);
    if (!saved) throw new Error('Dharti has no check-in');
    renderPatientFile(patientFileUrl(DHARTI, `/check-ins/${saved.id}/edit`), {
      role: 'doctor',
    });
    expect(
      await screen.findByTestId(`check-in-drawer-feel-${saved.feel}`),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('patient-section-overview')).toBeInTheDocument();
  });
});
