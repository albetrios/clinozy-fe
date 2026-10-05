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
const url = (rest: string) => patientFileUrl(DHARTI, `/reports${rest}`);
const rows = () => screen.findAllByTestId('patient-reports-table-row');

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientReportsPage', () => {
  it('renders the Reports section in the patient file', async () => {
    renderPatientFile(url(''));
    expect(await screen.findByTestId('patient-section-reports')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Reports' }),
    ).toBeInTheDocument();
  });

  it('lists her reports newest first, each with its type and who uploaded it (H:4760)', async () => {
    renderPatientFile(url(''));
    const [consent, lab] = await rows();
    if (!(consent && lab)) throw new Error('no rows');
    expect(within(consent).getByText('Chemical peel consent')).toBeInTheDocument();
    expect(within(consent).getAllByText('Consent').length).toBeGreaterThan(0);
    expect(within(lab).getByText('CBC + Thyroid profile')).toBeInTheDocument();
    expect(
      within(lab).getByText('PDF · shared with patient on request'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 reports')).toBeInTheDocument();
  });

  it('opens a report from its action; a row opens nothing', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(url(''));
    const [consent] = await rows();
    if (!consent) throw new Error('no row');
    await user.click(within(consent).getByText('Chemical peel consent'));
    expect(router.state.location.pathname).toBe(url(''));
    await user.click(within(consent).getByTestId('patient-reports-row-action-open'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(url(`/${ref.patientReport(2)}`)),
    );
    expect(await screen.findByTestId('report-view')).toBeInTheDocument();
  });

  it('asks before deleting a report and offers Undo', async () => {
    const user = userEvent.setup();
    renderPatientFile(url(''), { role: 'owner' });
    const [consent] = await rows();
    if (!consent) throw new Error('no row');
    await user.click(within(consent).getByTestId('patient-reports-row-action-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this report?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Chemical peel consent',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(notifyMock.undo).toHaveBeenCalledWith('Report deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(async () => expect(await rows()).toHaveLength(2));
  });

  it('keeps Delete from a member without patients.delete', async () => {
    renderPatientFile(url(''), { role: 'front_desk' });
    await rows();
    expect(screen.getAllByTestId('patient-reports-row-action-open')).toHaveLength(2);
    expect(
      screen.queryByTestId('patient-reports-row-action-delete'),
    ).not.toBeInTheDocument();
  });
});
