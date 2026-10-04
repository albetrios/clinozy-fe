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

describe('NewReviewPage (S:46)', () => {
  it('shows the section it came from with a new review on its source', async () => {
    renderPatientFile(
      `${patientFileUrl(DHARTI, '/reviews/create')}?from=visits&source=whatsapp`,
      { role: 'doctor' },
    );
    expect(await screen.findByTestId('review-drawer-where-whatsapp')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('patient-section-visits')).toBeInTheDocument();
    expect(clinicFixtures.reviews.snapshot(() => true).length).toBeGreaterThan(0);
  });
});
