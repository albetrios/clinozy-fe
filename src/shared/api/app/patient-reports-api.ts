import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import type { DeleteReason } from './app-schema.ts';
import {
  type PatientReport,
  type PatientReportInput,
  type PatientReportList,
  patientReportRowWire,
  patientReportWire,
  reportCreateBodyOf,
  toPatientReport,
} from './patient-reports-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * A patient's reports on clinozy-be (`/app/patients/:patient_id/reports`, api-integration
 * §5.4): the list (every page for the Reports table, or the newest few), one report, a create
 * whose files follow — each attached by a change of `file_keys` as the upload tray confirms it —
 * delete with its reason and restore. Every write carries the action's key.
 */

/**
 * TanStack Query keys for the reports — under the patients' key, so a patient write refreshes
 * them; each carries the organization and the patient.
 */
export const patientReportQueryKeys = {
  all: [...patientQueryKeys.all, 'reports'] as const,
  /** Everything of one patient's reports — a report write invalidates it. */
  patient: (organizationId: string | null, patientId: string) =>
    [...patientReportQueryKeys.all, organizationId, patientId] as const,
  /** The list: every report (`limit` null), or the newest `limit`. */
  list: (organizationId: string | null, patientId: string, limit: number | null) =>
    [
      ...patientReportQueryKeys.patient(organizationId, patientId),
      'list',
      limit,
    ] as const,
  detail: (organizationId: string | null, patientId: string, reportId: string) =>
    [
      ...patientReportQueryKeys.patient(organizationId, patientId),
      'detail',
      reportId,
    ] as const,
};

/** A page of the full read — the API's most. */
const ALL_PAGE_SIZE = 100;

/** One page of the patient's reports, newest first. */
async function readReportPage(patientId: string, limit: number, after?: string) {
  const response = await api.get('/app/patients/{patient_id}/reports', {
    params: { patient_id: patientId },
    query: { sort: 'report_date', order: 'desc', limit, after },
  });
  const pagination = response.meta?.pagination;
  return {
    rows: z
      .array(patientReportRowWire)
      .parse(response.data ?? [])
      .map(toPatientReport),
    ...pageOf(pagination),
  };
}

/**
 * A patient's reports, newest first: every page (the Reports table shows them all), or only
 * the newest `limit` — with the server's total either way.
 */
export async function listPatientReports(
  patientId: string,
  { limit }: { limit?: number } = {},
): Promise<PatientReportList> {
  if (limit !== undefined) {
    const page = await readReportPage(patientId, limit);
    return { reports: page.rows, total: page.total ?? page.rows.length };
  }
  let total: number | null = null;
  const reports = await collectAllPages(async (cursor) => {
    const page = await readReportPage(patientId, ALL_PAGE_SIZE, cursor ?? undefined);
    total ??= page.total;
    return page;
  }, 'patient-reports');
  return { reports, total: total ?? reports.length };
}

/** One report — a 404 when it is deleted or unknown. */
export async function fetchPatientReport({
  patientId,
  reportId,
}: {
  patientId: string;
  reportId: string;
}): Promise<PatientReport> {
  const response = await api.get(
    '/app/patients/{patient_id}/reports/{patient_report_id}',
    { params: { patient_id: patientId, patient_report_id: reportId } },
  );
  return toPatientReport(patientReportWire.parse(response.data));
}

/**
 * Upload report: the record with no files yet — each is attached as its upload is confirmed
 * ({@link attachPatientReportFile}). A blank or too long name, or a note past 1,000, is a 400
 * on its field.
 */
export async function createPatientReport({
  patientId,
  input,
  idempotencyKey,
}: {
  patientId: string;
  input: PatientReportInput;
  idempotencyKey: string;
}): Promise<PatientReport> {
  const response = await api.post('/app/patients/{patient_id}/reports', {
    params: { patient_id: patientId },
    body: reportCreateBodyOf(input),
    idempotencyKey,
  });
  return toPatientReport(patientReportWire.parse(response.data));
}

/** Each report's attach in flight — a report's files are attached one after another. */
const attaching = new Map<string, Promise<unknown>>();

/**
 * Attach an uploaded file to a report — the storage key the upload tray confirmed: the report
 * is read and its `file_keys` changed to carry the key too, with the read's `updated_at`. A key
 * already on it is not added twice (the tray's Retry); the server refuses an eleventh file.
 * Attaches to one report run one at a time, so two files landing together never overwrite each
 * other.
 */
export function attachPatientReportFile({
  patientId,
  reportId,
  fileKey,
}: {
  patientId: string;
  reportId: string;
  fileKey: string;
}): Promise<PatientReport> {
  const attach = async () => {
    const report = await fetchPatientReport({ patientId, reportId });
    if (report.fileKeys.includes(fileKey)) return report;
    const response = await api.patch(
      '/app/patients/{patient_id}/reports/{patient_report_id}',
      {
        params: { patient_id: patientId, patient_report_id: reportId },
        body: {
          file_keys: [...report.fileKeys, fileKey],
          expected_updated_at: report.updatedAt,
        },
        idempotencyKey: `report-file:${reportId}:${fileKey}`,
      },
    );
    return toPatientReport(patientReportWire.parse(response.data));
  };
  const previous = attaching.get(reportId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(attach);
  attaching.set(reportId, next);
  void next
    .catch(() => undefined)
    .finally(() => {
      if (attaching.get(reportId) === next) attaching.delete(reportId);
    });
  return next;
}

/** Delete a report with the confirm's reason (restorable — "Report deleted" offers Undo). */
export async function deletePatientReport({
  patientId,
  reportId,
  reason,
  note,
}: {
  patientId: string;
  reportId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/patients/{patient_id}/reports/{patient_report_id}', {
    params: { patient_id: patientId, patient_report_id: reportId },
    reason,
    note: note ?? undefined,
  });
}

/** Restore a deleted report — the delete toast's Undo. */
export async function restorePatientReport({
  patientId,
  reportId,
  idempotencyKey,
}: {
  patientId: string;
  reportId: string;
  idempotencyKey: string;
}): Promise<PatientReport> {
  const response = await api.post(
    '/app/patients/{patient_id}/reports/{patient_report_id}/restore',
    { params: { patient_id: patientId, patient_report_id: reportId }, idempotencyKey },
  );
  return toPatientReport(patientReportWire.parse(response.data));
}
