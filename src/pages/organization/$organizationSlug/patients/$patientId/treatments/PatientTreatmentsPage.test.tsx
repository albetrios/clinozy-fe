import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

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

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const DHARTI = patientRef('Dharti Galani');
/** Dharti's LHR Full Face session (H:3674). */
const LHR = ref.treatment(498);
const url = (rest: string) => patientFileUrl(DHARTI, `/treatments${rest}`);
const action = (id: string) => `patient-treatments-row-action-${id}`;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientTreatmentsPage', () => {
  it('renders the Treatments section in the patient file', async () => {
    renderPatientFile(url(''));
    expect(await screen.findByTestId('patient-section-treatments')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Treatments' }),
    ).toBeInTheDocument();
  });

  it('lists her treatment — the template, the area, the session and its check-in (H:4754)', async () => {
    renderPatientFile(url(''), { role: 'doctor' });
    const [row] = await screen.findAllByTestId('patient-treatments-table-row');
    if (!row) throw new Error('no row');
    expect(within(row).getByText('LHR Full Face')).toBeInTheDocument();
    expect(within(row).getByText('Skin · laser')).toBeInTheDocument();
    expect(within(row).getAllByText('Face').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('#1').length).toBeGreaterThan(0);
    const feedback = await within(row).findByText('Better · 7/10');
    expect(feedback.closest('[title]')).toHaveAttribute(
      'title',
      expect.stringMatching(/^Check-in /),
    );
    expect(screen.getByText('1 treatment')).toBeInTheDocument();
  });

  it('opens Edit treatment from a row', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(''), { role: 'doctor' });
    const [row] = await screen.findAllByTestId('patient-treatments-table-row');
    if (!row) throw new Error('no row');
    await user.click(within(row).getByText('LHR Full Face'));
    await waitFor(() => expect(router.state.location.pathname).toBe(url(`/${LHR}/edit`)));
    expect(await screen.findByTestId('treatment-drawer')).toBeInTheDocument();
  });

  it('copies a treatment as its next session', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(''), { role: 'doctor' });
    await user.click(await screen.findByTestId(action('copy')));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 added'),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('patient-treatments-table-row')).toHaveLength(2),
    );
  });

  it('logs a check-in for the treatment over the section', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(''), { role: 'doctor' });
    await user.click(await screen.findByTestId(action('check-in')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(DHARTI, '/check-ins/create'),
      ),
    );
    expect(router.state.location.search).toEqual({
      from: 'treatments',
      treatment: LHR,
    });
    expect(await screen.findByTestId('check-in-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('patient-section-treatments')).toBeInTheDocument();
  });

  it('asks before deleting a treatment and offers Undo', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(''), { role: 'owner' });
    await user.click(await screen.findByTestId(action('delete')));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this treatment?')).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    expect(await screen.findByText('No treatments yet')).toBeInTheDocument();
    expect(notifyMock.undo).toHaveBeenCalledWith('Treatment deleted', {
      onUndo: expect.any(Function),
    });
  });

  it('leaves a member without the treatment gate the check-in only', async () => {
    renderPatientFile(url(''), { role: 'admin' });
    expect(await screen.findByTestId(action('check-in'))).toBeInTheDocument();
    expect(screen.queryByTestId(action('copy'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('edit'))).not.toBeInTheDocument();
    expect(screen.queryByTestId(action('delete'))).not.toBeInTheDocument();
  });
});
