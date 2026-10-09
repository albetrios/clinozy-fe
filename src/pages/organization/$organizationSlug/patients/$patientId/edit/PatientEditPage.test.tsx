import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const DHARTI = patientRef('Dharti Galani');

beforeEach(() => {
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientEditPage', () => {
  it('opens Edit patient over the section it came from', async () => {
    const { baseElement } = renderPatientFile(
      `${patientFileUrl(DHARTI, '/edit')}?from=images`,
    );
    expect(await screen.findByTestId('patient-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('opens over Clinical notes when it came from no section', async () => {
    renderPatientFile(`${patientFileUrl(DHARTI, '/edit')}?from=nowhere`);
    await screen.findByTestId('patient-drawer');
    expect(screen.getByTestId('patient-section-overview')).toBeInTheDocument();
  });

  it('closes back to that section, in place', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(
      `${patientFileUrl(DHARTI, '/edit')}?from=visits`,
    );
    await user.click(await screen.findByTestId('patient-drawer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/visits')),
    );
    expect(router.history).toHaveLength(1);
  });
});
