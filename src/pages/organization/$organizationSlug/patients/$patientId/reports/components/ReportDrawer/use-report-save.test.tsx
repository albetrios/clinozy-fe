import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientReportQueryKeys } from '@/shared/api/app/patient-reports-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

const { notifyMock, reportsApi, uploads } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  reportsApi: { createPatientReport: vi.fn(), attachPatientReportFile: vi.fn() },
  uploads: { enqueue: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/patient-reports-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...reportsApi,
}));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => uploads,
}));

import { reportDouble } from '../../__tests__/integration/report-api-double.ts';
import { newReportForm, type ReportFormValues } from './report-form.ts';
import { useReportSave } from './use-report-save.ts';

const validation = (field: string, message: string) =>
  new HttpError('HTTP 400', 400, '/api/v1/app/patients/x/reports', 'POST', {
    error: { type: 'validation_error', errors: [{ field, message }] },
  });

const cbc = (patch: Partial<ReportFormValues> = {}): ReportFormValues => ({
  ...newReportForm('2026-10-12'),
  name: ' CBC + Thyroid ',
  note: ' Fasting ',
  ...patch,
});

const picked = (name: string) => ({
  id: name,
  file: new File(['x'], name, { type: 'application/pdf' }),
});

describe('useReportSave — Upload report’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render(values: ReportFormValues) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<ReportFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useReportSave({ form, patientId: TEST_PATIENT_ID, onStep, onDone }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [
      ...Object.values(notifyMock),
      ...Object.values(reportsApi),
      uploads.enqueue,
    ]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  it('asks for a name before anything is sent, and opens the Report step', async () => {
    const { result, onStep } = render(cbc({ name: '  ' }));
    await act(() => result.current.drawer.save());
    expect(result.current.form.getFieldState('name').error?.message).toBe(
      'Name the report',
    );
    expect(onStep).toHaveBeenCalledWith('report');
    expect(reportsApi.createPatientReport).not.toHaveBeenCalled();
  });

  it('writes the report — the name trimmed, the note kept — with no files to file', async () => {
    const report = reportDouble({ fileKeys: [] });
    reportsApi.createPatientReport.mockResolvedValue(report);
    const { result, onDone } = render(cbc());

    await act(() => result.current.drawer.save());

    expect(reportsApi.createPatientReport).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      input: { type: 'lab', name: 'CBC + Thyroid', date: '2026-10-12', notes: 'Fasting' },
      idempotencyKey: expect.any(String),
    });
    expect(uploads.enqueue).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(report);
  });

  it('hands each picked file to the upload tray, which attaches it to the report', async () => {
    const report = reportDouble({ fileKeys: [] });
    reportsApi.createPatientReport.mockResolvedValue(report);
    reportsApi.attachPatientReportFile.mockResolvedValue(report);
    const files = [picked('cbc.pdf'), picked('thyroid.pdf')];
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result, onDone } = render(cbc({ files }));

    await act(() => result.current.drawer.save());

    expect(uploads.enqueue).toHaveBeenCalledWith(
      files.map((one) => one.file),
      { onUploaded: expect.any(Function) },
    );
    expect(onDone).toHaveBeenCalledWith(report);

    const [, target] = uploads.enqueue.mock.lastCall as [
      File[],
      { onUploaded: (key: string) => Promise<void> },
    ];
    invalidate.mockClear();
    await target.onUploaded('org/reports/cbc.pdf');
    expect(reportsApi.attachPatientReportFile).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      reportId: report.id,
      fileKey: 'org/reports/cbc.pdf',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: patientReportQueryKeys.all });
  });

  it('puts the API’s names on the form’s fields and opens their step', async () => {
    const cases: [string, keyof ReportFormValues, string][] = [
      ['body.report_date', 'date', 'details'],
      ['body.notes', 'note', 'notes'],
      ['body.name', 'name', 'report'],
    ];
    for (const [field, formField, step] of cases) {
      reportsApi.createPatientReport.mockRejectedValueOnce(validation(field, 'Refused'));
      const { result, onStep, onDone } = render(cbc());
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState(formField).error?.message).toBe('Refused');
      expect(onStep).toHaveBeenCalledWith(step);
      expect(onDone).not.toHaveBeenCalled();
    }
  });

  it('files nothing when the report is refused', async () => {
    reportsApi.createPatientReport.mockRejectedValue(validation('body.name', 'Too long'));
    const { result } = render(cbc({ files: [picked('cbc.pdf')] }));

    await act(() => result.current.drawer.save());

    expect(uploads.enqueue).not.toHaveBeenCalled();
  });
});
