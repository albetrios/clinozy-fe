import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import { civilDateSchema, type ReportType, reportTypeSchema } from './app-schema.ts';
import { stableFileUrl } from './file-links.ts';

/*
 * A patient's reports on clinozy-be (`/app/patients/:patient_id/reports`, api-integration
 * §5.4): a named, typed, dated record with an optional note and up to ten stored files
 * (`file_keys`). It does not say who added it (G4). Each read gives every file its upload's
 * name and a link that opens it (`files`, clinozy-be D86) — valid 15 minutes and made fresh on
 * every read, both null when the upload is gone.
 */

/** The API's limits on a report (its 400s name the field past them). */
export const REPORT_LIMITS = {
  name: 120,
  notes: 1000,
  /** Files on one report. */
  files: 10,
} as const;

/** One report as the patient file reads it. */
export interface PatientReport {
  /** `prep_…`. */
  id: string;
  patientId: string;
  type: ReportType;
  name: string;
  /** The report's own civil day, `YYYY-MM-DD`. */
  date: string;
  /** The stored files' keys, in the order they were attached. */
  fileKeys: string[];
  /** The same files with their names and links (D86), in the same order. */
  files: PatientReportFile[];
  notes: string | null;
  createdAt: string;
  /** The read's stamp — a change sends it back as `expected_updated_at`. */
  updatedAt: string;
}

/** One of a report's files: its key, the name it was uploaded under and a link that opens it. */
export interface PatientReportFile {
  fileKey: string;
  /** Null when the upload is gone. */
  fileName: string | null;
  /** Valid 15 minutes from the read (D86); null when the upload is gone. */
  fileUrl: string | null;
}

// ── The wire ──

type ApiPatientReport = NonNullable<
  ApiData<'/app/patients/{patient_id}/reports/{patient_report_id}', 'get'>
>;
type ApiPatientReportRow = NonNullable<
  ApiData<'/app/patients/{patient_id}/reports', 'get'>
>[number];

/** One report as clinozy-be answers it — the same on the list, the read and each write. */
export const patientReportWire = wireSchema<ApiPatientReport>()(
  z.object({
    id: z.string(),
    patient_id: z.string(),
    type: reportTypeSchema,
    name: z.string(),
    report_date: civilDateSchema,
    file_keys: z.array(z.string()),
    files: z.array(
      z.object({
        file_key: z.string(),
        file_name: z.string().nullable(),
        file_url: z.string().nullable(),
      }),
    ),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** A list row — checked against the list's own type too. */
export const patientReportRowWire = wireSchema<ApiPatientReportRow>()(patientReportWire);

/** The wire report as the file reads it. */
export function toPatientReport(row: z.output<typeof patientReportWire>): PatientReport {
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    name: row.name,
    date: row.report_date,
    fileKeys: row.file_keys,
    files: row.files.map((file) => ({
      fileKey: file.file_key,
      fileName: file.file_name,
      fileUrl: stableFileUrl(file.file_key, file.file_url),
    })),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A patient's reports, newest first, and how many the server counts. */
export interface PatientReportList {
  reports: PatientReport[];
  /** `meta.pagination.estimated_total`; the reports read when it is not told. */
  total: number;
}

// ── Writes ──

/** What Upload report sends; its files follow as the upload tray confirms each one. */
export interface PatientReportInput {
  type: ReportType;
  name: string;
  /** `YYYY-MM-DD`. */
  date: string;
  notes: string | null;
}

/** A new report as `POST /app/patients/:patient_id/reports` takes it. */
export function reportCreateBodyOf(
  input: PatientReportInput,
): ApiBody<'/app/patients/{patient_id}/reports', 'post'> {
  return {
    type: input.type,
    name: input.name,
    report_date: input.date,
    notes: input.notes,
  };
}
