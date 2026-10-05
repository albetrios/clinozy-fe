import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

const { notifyMock, enqueueMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  enqueueMock: vi.fn(() => ({ accepted: 1, skipped: 0 })),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: enqueueMock }),
}));

const DHARTI = patientRef('Dharti Galani');
const url = (rest: string) => patientFileUrl(DHARTI, `/reports${rest}`);
const reportsOf = () =>
  clinicFixtures.patientReports.snapshot((row) => row.patientId === DHARTI);

async function openUpload() {
  const user = userEvent.setup({ applyAccept: false });
  const view = renderPatientFile(url('/create'), { role: 'doctor' });
  const drawer = await screen.findByTestId('report-drawer');
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  enqueueMock.mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Upload report (KICKOFF §6.6; S:42)', () => {
  it('opens over Reports with its steps, Lab and today', async () => {
    const { drawer, baseElement } = await openUpload();
    expect(within(drawer).getByTestId('report-drawer-title')).toHaveTextContent(
      'Upload report',
    );
    expect(drawer).toHaveTextContent('Dharti Galani');
    expect(within(drawer).getByTestId('report-drawer-step-report')).toHaveTextContent(
      'Report',
    );
    expect(within(drawer).getByTestId('report-drawer-type-lab')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId('report-drawer-name')).toHaveAttribute(
      'placeholder',
      'e.g. CBC report',
    );
    expect(within(drawer).getByTestId('report-drawer-summary')).toHaveTextContent(
      'Lab · 0 files',
    );
    expect(within(drawer).getByTestId('report-drawer-save')).toHaveTextContent('Upload');
    expect(screen.getByTestId('patient-section-reports')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('asks for a name before it uploads', async () => {
    const { user, drawer } = await openUpload();
    const before = reportsOf().length;
    await user.click(within(drawer).getByTestId('report-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Name the report');
    expect(within(drawer).getByTestId('report-drawer-name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(reportsOf()).toHaveLength(before);
  });

  it('uploads a scan with its file and note — “Report uploaded”', async () => {
    const { user, drawer, router } = await openUpload();
    await user.click(within(drawer).getByTestId('report-drawer-type-scan'));
    await user.type(within(drawer).getByTestId('report-drawer-name'), 'Chest X-ray');
    await user.click(within(drawer).getByTestId('report-drawer-step-notes-trigger'));
    const pdf = new File(['%PDF'], 'xray.pdf', { type: 'application/pdf' });
    await user.upload(within(drawer).getByTestId('report-drawer-file-input'), pdf);
    await user.type(within(drawer).getByTestId('report-drawer-note'), 'No findings');
    expect(within(drawer).getByTestId('report-drawer-summary')).toHaveTextContent(
      'Scan · 1 file',
    );
    await user.click(within(drawer).getByTestId('report-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Report uploaded'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    const saved = reportsOf().find((row) => row.name === 'Chest X-ray');
    expect(saved).toMatchObject({ type: 'scan', notes: 'No findings', files: [] });
    expect(enqueueMock).toHaveBeenCalledWith([pdf], expect.any(Object));
  });

  it('attaches each file to the report as the tray confirms it', async () => {
    const { user, drawer } = await openUpload();
    await user.type(within(drawer).getByTestId('report-drawer-name'), 'Lipid profile');
    await user.click(within(drawer).getByTestId('report-drawer-step-notes-trigger'));
    await user.upload(
      within(drawer).getByTestId('report-drawer-file-input'),
      new File(['%PDF'], 'lipid.pdf', { type: 'application/pdf' }),
    );
    await user.click(within(drawer).getByTestId('report-drawer-save'));
    await waitFor(() => expect(enqueueMock).toHaveBeenCalledTimes(1));
    const [, target] = enqueueMock.mock.calls[0] as unknown as [
      File[],
      { onUploaded: (key: string) => Promise<void> },
    ];
    await target.onUploaded('reports/lipid.pdf');
    expect(reportsOf().find((row) => row.name === 'Lipid profile')?.files).toEqual([
      'reports/lipid.pdf',
    ]);
  });

  it('turns a member who cannot edit patients back (S:42)', async () => {
    const { router } = renderPatientFile(url('/create'), { role: 'therapist' });
    await waitFor(() => expect(router.state.location.pathname).toBe(url('')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('report-drawer')).not.toBeInTheDocument();
  });
});
