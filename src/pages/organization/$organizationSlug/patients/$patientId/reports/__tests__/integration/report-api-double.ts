/**
 * The Reports tests' clinozy-be: `patient-reports-api.ts` over an in-memory set of reports —
 * every report newest first with the total, one report (a 404 when gone), create, a file's
 * attach, delete and restore. A suite swaps it in with `vi.mock` and seeds it with
 * {@link seedReports}; it never imports a component, so the mock factory can load it.
 */
import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import type {
  PatientReport,
  PatientReportFile,
  PatientReportInput,
  PatientReportList,
} from '@/shared/api/app/patient-reports-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

/** The patient the reports belong to (the shared `patientFile()` double's). */
const PATIENT_ID = 'pat_priya0000000000000000';

/** One of a report's files as the API answers it: its upload's name and a signed link (D86). */
export function reportFileDouble(fileKey: string): PatientReportFile {
  return {
    fileKey,
    fileName: fileKey.split('/').pop() ?? fileKey,
    fileUrl: `https://uploads.test/${fileKey}?X-Amz-Expires=900`,
  };
}

/**
 * One report as the API answers it — "CBC + Thyroid profile", Lab, 20 Sep, one PDF; its `files`
 * follow its `fileKeys` unless given.
 */
export function reportDouble(overrides: Partial<PatientReport> = {}): PatientReport {
  const fileKeys = overrides.fileKeys ?? ['organization-files/org_test/cbc.pdf'];
  return {
    id: 'prep_cbc00000000000000000',
    patientId: PATIENT_ID,
    type: 'lab',
    name: 'CBC + Thyroid profile',
    date: '2026-09-20',
    fileKeys,
    files: fileKeys.map(reportFileDouble),
    notes: null,
    createdAt: '2026-09-20T06:00:00.000Z',
    updatedAt: '2026-09-20T06:00:00.000Z',
    ...overrides,
  };
}

interface StoredReport {
  report: PatientReport;
  deleted: { reason: DeleteReason; note: string | null } | null;
}

let stored: StoredReport[] = [];

/** Put the store back to these reports (none deleted). */
export function seedReports(reports: readonly PatientReport[]): void {
  stored = reports.map((report) => ({ report: { ...report }, deleted: null }));
}

/** The store as it stands: every report with its delete, if any. */
export function storedReports(): readonly StoredReport[] {
  return stored;
}

const notFound = () =>
  new HttpError('Patient report not found', 404, '/app/patients/reports', 'GET', {
    error: {
      type: 'request_error',
      code: 'not_found',
      detail: 'Patient report not found',
    },
  });

function live(patientId: string, reportId: string): StoredReport {
  const row = stored.find(
    (entry) =>
      entry.report.id === reportId &&
      entry.report.patientId === patientId &&
      entry.deleted === null,
  );
  if (!row) throw notFound();
  return row;
}

/** `listPatientReports`: the live reports, newest first, the newest `limit` when asked. */
export async function listPatientReports(
  patientId: string,
  { limit }: { limit?: number } = {},
): Promise<PatientReportList> {
  const reports = stored
    .filter((entry) => entry.report.patientId === patientId && entry.deleted === null)
    .map((entry) => ({ ...entry.report }))
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  return {
    reports: limit === undefined ? reports : reports.slice(0, limit),
    total: reports.length,
  };
}

/** `fetchPatientReport`: one live report, else a 404. */
export async function fetchPatientReport({
  patientId,
  reportId,
}: {
  patientId: string;
  reportId: string;
}): Promise<PatientReport> {
  return { ...live(patientId, reportId).report };
}

/** `createPatientReport`: a new report with no files yet. */
export async function createPatientReport({
  patientId,
  input,
}: {
  patientId: string;
  input: PatientReportInput;
  idempotencyKey: string;
}): Promise<PatientReport> {
  const report = reportDouble({
    id: `prep_${String(stored.length).padStart(21, 'n')}`,
    patientId,
    ...input,
    fileKeys: [],
    createdAt: '2026-10-09T08:00:00.000Z',
    updatedAt: '2026-10-09T08:00:00.000Z',
  });
  stored.push({ report, deleted: null });
  return { ...report };
}

/** `attachPatientReportFile`: the key joins the report's files. */
export async function attachPatientReportFile({
  patientId,
  reportId,
  fileKey,
}: {
  patientId: string;
  reportId: string;
  fileKey: string;
}): Promise<PatientReport> {
  const row = live(patientId, reportId);
  if (!row.report.fileKeys.includes(fileKey)) {
    row.report = {
      ...row.report,
      fileKeys: [...row.report.fileKeys, fileKey],
      files: [...row.report.files, reportFileDouble(fileKey)],
    };
  }
  return { ...row.report };
}

/** `deletePatientReport`: the report leaves every read, its reason kept. */
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
  live(patientId, reportId).deleted = { reason, note };
}

/** `restorePatientReport`: a deleted report comes back. */
export async function restorePatientReport({
  patientId,
  reportId,
}: {
  patientId: string;
  reportId: string;
  idempotencyKey: string;
}): Promise<PatientReport> {
  const row = stored.find(
    (entry) => entry.report.id === reportId && entry.report.patientId === patientId,
  );
  if (!row) throw notFound();
  row.deleted = null;
  return { ...row.report };
}
