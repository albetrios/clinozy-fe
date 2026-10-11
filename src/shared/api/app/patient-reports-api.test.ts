import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  attachPatientReportFile,
  createPatientReport,
  deletePatientReport,
  fetchPatientReport,
  listPatientReports,
  patientReportQueryKeys,
  restorePatientReport,
} from './patient-reports-api.ts';
import { patientQueryKeys } from './patients-api.ts';

const PATIENT_ID = 'pat_rhuanxgy2umhsl3av5xjr';
const REPORT_ID = 'prep_gwlzqinmx87mwn2d1owyi';
const CBC = 'organization-files/org_1kugs30wim2jh5k4zw2yk/groupd-cbc-report.pdf';
const LIPID = 'organization-files/org_1kugs30wim2jh5k4zw2yk/groupd-lipid-panel.pdf';

/** One of a report's files as clinozy-be answers it (D86): the upload's name, a signed link. */
const fileRow = (fileKey: string) => ({
  file_key: fileKey,
  file_name: fileKey.split('/').pop() ?? fileKey,
  file_url: `https://clinozy-uploads.s3.amazonaws.com/${fileKey}?X-Amz-Expires=900`,
});

/** A report as the local stack answered it (`POST …/reports`, 10 Oct 2026); `files` follow its keys. */
const reportRow = (patch: Record<string, unknown> = {}) => {
  const fileKeys = (patch.file_keys as string[] | undefined) ?? [CBC];
  return {
    id: REPORT_ID,
    patient_id: PATIENT_ID,
    type: 'lab',
    name: 'CBC',
    report_date: '2026-10-05',
    file_keys: fileKeys,
    files: fileKeys.map(fileRow),
    notes: 'Fasting sample',
    created_at: '2026-10-10T01:44:20.862Z',
    updated_at: '2026-10-10T01:44:20.862Z',
    ...patch,
  };
};

const listPage = (rows: unknown[], pagination: Record<string, unknown> = {}) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next: null, has_more: false, ...pagination },
  },
});

beforeEach(() => vi.resetAllMocks());

describe('listPatientReports', () => {
  it('reads every page, newest first, with the server’s total', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        listPage([reportRow()], {
          next: 'cursor',
          has_more: true,
          estimated_total: 2,
        }) as never,
      )
      .mockResolvedValueOnce(
        listPage([
          reportRow({ id: 'prep_spkf93tnu56pu178oxno1', file_keys: [] }),
        ]) as never,
      );

    const list = await listPatientReports(PATIENT_ID);

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/patients/{patient_id}/reports', {
      params: { patient_id: PATIENT_ID },
      query: { sort: 'report_date', order: 'desc', limit: 100, after: undefined },
    });
    expect(vi.mocked(api.get).mock.calls[1]?.[1]).toMatchObject({
      query: { after: 'cursor' },
    });
    expect(list.total).toBe(2);
    expect(list.reports).toEqual([
      {
        id: REPORT_ID,
        patientId: PATIENT_ID,
        type: 'lab',
        name: 'CBC',
        date: '2026-10-05',
        fileKeys: [CBC],
        files: [
          {
            fileKey: CBC,
            fileName: 'groupd-cbc-report.pdf',
            fileUrl: `https://clinozy-uploads.s3.amazonaws.com/${CBC}?X-Amz-Expires=900`,
          },
        ],
        notes: 'Fasting sample',
        createdAt: '2026-10-10T01:44:20.862Z',
        updatedAt: '2026-10-10T01:44:20.862Z',
      },
      expect.objectContaining({
        id: 'prep_spkf93tnu56pu178oxno1',
        fileKeys: [],
        files: [],
      }),
    ]);
  });

  it('reads only the newest few when asked, keeping the server’s total', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      listPage([reportRow()], {
        next: 'cursor',
        has_more: true,
        estimated_total: 9,
      }) as never,
    );

    const list = await listPatientReports(PATIENT_ID, { limit: 3 });

    expect(api.get).toHaveBeenCalledOnce();
    expect(vi.mocked(api.get).mock.calls[0]?.[1]).toMatchObject({ query: { limit: 3 } });
    expect(list.total).toBe(9);
    expect(list.reports).toHaveLength(1);
  });
});

describe('one report and its writes', () => {
  it('reads one report', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: reportRow() } as never);

    const report = await fetchPatientReport({
      patientId: PATIENT_ID,
      reportId: REPORT_ID,
    });

    expect(api.get).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/reports/{patient_report_id}',
      { params: { patient_id: PATIENT_ID, patient_report_id: REPORT_ID } },
    );
    expect(report.name).toBe('CBC');
  });

  it('writes a new report with no files yet, with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: reportRow({ file_keys: [] }),
    } as never);

    const report = await createPatientReport({
      patientId: PATIENT_ID,
      input: { type: 'scan', name: 'Chest X-ray', date: '2026-10-05', notes: null },
      idempotencyKey: 'key-1',
    });

    expect(api.post).toHaveBeenCalledWith('/app/patients/{patient_id}/reports', {
      params: { patient_id: PATIENT_ID },
      body: { type: 'scan', name: 'Chest X-ray', report_date: '2026-10-05', notes: null },
      idempotencyKey: 'key-1',
    });
    expect(report.fileKeys).toEqual([]);
  });

  it('attaches a file by reading the report and adding its key, with the read’s updated_at', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: reportRow() } as never);
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: reportRow({ file_keys: [CBC, LIPID] }),
    } as never);

    const report = await attachPatientReportFile({
      patientId: PATIENT_ID,
      reportId: REPORT_ID,
      fileKey: LIPID,
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/reports/{patient_report_id}',
      {
        params: { patient_id: PATIENT_ID, patient_report_id: REPORT_ID },
        body: {
          file_keys: [CBC, LIPID],
          expected_updated_at: '2026-10-10T01:44:20.862Z',
        },
        idempotencyKey: `report-file:${REPORT_ID}:${LIPID}`,
      },
    );
    expect(report.fileKeys).toEqual([CBC, LIPID]);
  });

  it('does not add a key the report already holds (the tray’s Retry)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: reportRow() } as never);

    await attachPatientReportFile({
      patientId: PATIENT_ID,
      reportId: REPORT_ID,
      fileKey: CBC,
    });

    expect(api.patch).not.toHaveBeenCalled();
  });

  it('attaches two files landing together one after the other', async () => {
    const keys: string[][] = [[]];
    vi.mocked(api.get).mockImplementation(
      async () => ({ data: reportRow({ file_keys: keys.at(-1) }) }) as never,
    );
    vi.mocked(api.patch).mockImplementation(async (_path, init) => {
      const body = (init as { body: { file_keys: string[] } }).body;
      keys.push(body.file_keys);
      return { data: reportRow({ file_keys: body.file_keys }) } as never;
    });

    await Promise.all([
      attachPatientReportFile({
        patientId: PATIENT_ID,
        reportId: REPORT_ID,
        fileKey: CBC,
      }),
      attachPatientReportFile({
        patientId: PATIENT_ID,
        reportId: REPORT_ID,
        fileKey: LIPID,
      }),
    ]);

    expect(keys.at(-1)).toEqual([CBC, LIPID]);
  });

  it('deletes with the reason and note, and restores with the action’s key', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined } as never);
    vi.mocked(api.post).mockResolvedValueOnce({ data: reportRow() } as never);

    await deletePatientReport({
      patientId: PATIENT_ID,
      reportId: REPORT_ID,
      reason: 'other',
      note: 'Wrong file',
    });
    await restorePatientReport({
      patientId: PATIENT_ID,
      reportId: REPORT_ID,
      idempotencyKey: 'key-2',
    });

    expect(api.delete).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/reports/{patient_report_id}',
      {
        params: { patient_id: PATIENT_ID, patient_report_id: REPORT_ID },
        reason: 'other',
        note: 'Wrong file',
      },
    );
    expect(api.post).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/reports/{patient_report_id}/restore',
      {
        params: { patient_id: PATIENT_ID, patient_report_id: REPORT_ID },
        idempotencyKey: 'key-2',
      },
    );
  });

  it('keys the reports under the patients’ key, by organization and patient', () => {
    expect(patientReportQueryKeys.list('org_a', PATIENT_ID, null)).toEqual([
      ...patientQueryKeys.all,
      'reports',
      'org_a',
      PATIENT_ID,
      'list',
      null,
    ]);
  });
});
