import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReportsApiModule from '@/shared/api/clinic/patient-reports-api.ts';
import {
  attachPatientReportFile,
  createPatientReport,
} from '@/shared/api/clinic/patient-reports-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  seedReports,
  storedReports,
} from '../../__tests__/integration/report-api-double.ts';
import {
  renderReports,
  REPORT_CODES,
  reportsUrl,
  resetReports,
} from '../../__tests__/integration/reports-test-router.tsx';

vi.mock('@/shared/api/clinic/patient-reports-api.ts', async (importOriginal) => {
  const double = await import('../../__tests__/integration/report-api-double.ts');
  return {
    ...(await importOriginal<typeof ReportsApiModule>()),
    listPatientReports: vi.fn(double.listPatientReports),
    fetchPatientReport: vi.fn(double.fetchPatientReport),
    createPatientReport: vi.fn(double.createPatientReport),
    attachPatientReportFile: vi.fn(double.attachPatientReportFile),
  };
});

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
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notify: notifyMock,
}));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: enqueueMock }),
}));

const created = () => storedReports().map((row) => row.report);

async function openUpload() {
  const user = userEvent.setup({ applyAccept: false });
  const view = renderReports(reportsUrl('/create'));
  const drawer = await screen.findByTestId('report-drawer');
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  enqueueMock.mockClear();
  vi.mocked(createPatientReport).mockClear();
  seedReports([]);
});
afterEach(() => resetReports());

describe('Upload report (KICKOFF §6.6; S:42)', () => {
  it('opens over Reports with its steps, Lab and today', async () => {
    const { drawer, baseElement } = await openUpload();
    expect(within(drawer).getByTestId('report-drawer-title')).toHaveTextContent(
      'Upload report',
    );
    expect(drawer).toHaveTextContent('Priya Shah');
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
    await user.click(within(drawer).getByTestId('report-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Name the report');
    expect(within(drawer).getByTestId('report-drawer-name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createPatientReport).not.toHaveBeenCalled();
  });

  it('uploads a scan with its note — "Report uploaded" — and queues its file', async () => {
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
    await waitFor(() => expect(router.state.location.pathname).toBe(reportsUrl()));
    expect(createPatientReport).toHaveBeenCalledWith({
      patientId: 'pat_priya0000000000000000',
      input: {
        type: 'scan',
        name: 'Chest X-ray',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        notes: 'No findings',
      },
      idempotencyKey: expect.any(String),
    });
    expect(created()[0]).toMatchObject({
      type: 'scan',
      notes: 'No findings',
      fileKeys: [],
    });
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
    await target.onUploaded('organization-files/org_test/lipid.pdf');
    const report = created()[0];
    expect(attachPatientReportFile).toHaveBeenCalledWith({
      patientId: 'pat_priya0000000000000000',
      reportId: report?.id,
      fileKey: 'organization-files/org_test/lipid.pdf',
    });
    expect(report?.fileKeys).toEqual(['organization-files/org_test/lipid.pdf']);
  });

  it('outlines the field the server refuses, on its step', async () => {
    vi.mocked(createPatientReport).mockRejectedValueOnce(
      new HttpError('Invalid', 400, '/x', 'POST', {
        error: {
          type: 'validation_error',
          detail: 'Invalid values for fields in request',
          errors: [
            {
              field: 'body.notes',
              message: 'Too big: expected string to have <=1000 characters',
            },
          ],
        },
      }),
    );
    const { user, drawer } = await openUpload();
    await user.type(within(drawer).getByTestId('report-drawer-name'), 'CBC');
    await user.click(within(drawer).getByTestId('report-drawer-save'));
    expect(
      await within(drawer).findByText(
        'Too big: expected string to have <=1000 characters',
      ),
    ).toBeInTheDocument();
    expect(within(drawer).getByTestId('report-drawer-note')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('turns a member without patient:update back', async () => {
    const { router } = renderReports(reportsUrl('/create'), {
      codes: REPORT_CODES.filter((code) => code !== 'patient:update'),
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(reportsUrl()));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('report-drawer')).not.toBeInTheDocument();
  });
});
