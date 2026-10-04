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

describe('EditReviewPage (S:47)', () => {
  it('opens the review prefilled over Clinical notes', async () => {
    const [saved] = clinicFixtures.reviews.snapshot((row) => row.patientId === DHARTI);
    if (!saved) throw new Error('Dharti has no review');
    renderPatientFile(patientFileUrl(DHARTI, `/reviews/${saved.id}/edit`), {
      role: 'doctor',
    });
    expect(
      await screen.findByTestId(`review-drawer-where-${saved.source}`),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('review-drawer-save')).toHaveTextContent('Save changes');
    expect(screen.getByTestId('patient-section-overview')).toBeInTheDocument();
  });
});
