import { z } from 'zod';

import { compareText, validateClinicInput } from './clinic-fixture-store.ts';
import {
  civilDateSchema,
  type DeleteReason,
  type PatientReport,
  reportTypeSchema,
} from './clinic-schema.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * The patient file's reports (`createReport`, `S:1644`; KICKOFF §6.6 Upload
 * report, Report view), on the fixture world until clinozy-be serves them —
 * REPLACE_WITH_API (D6). A report is written first; its files follow as the
 * upload tray confirms each one.
 */

/** TanStack Query keys for reports — under the patients' key (the file's counts). */
export const patientReportQueryKeys = {
  all: [...patientQueryKeys.all, 'reports'] as const,
  /** One patient's reports, newest first. */
  patient: (patientId: string) =>
    [...patientReportQueryKeys.all, 'patient', patientId] as const,
  detail: (id: string) => [...patientReportQueryKeys.all, 'detail', id] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** The drawer's limits (`patient-file.md:143–157`; the contract's, `S:444–449`). */
export const REPORT_LIMITS = {
  name: 120,
  notes: 1000,
  /** Files on one report. */
  files: 10,
} as const;

/** What Upload report sends (`createReport`, `S:1644`); its files follow. */
const patientReportInputSchema = z.object({
  patientId: z.uuid(),
  type: reportTypeSchema,
  name: z.string().trim().min(1, 'Name the report').max(REPORT_LIMITS.name),
  date: civilDateSchema,
  notes: z.string().max(REPORT_LIMITS.notes).nullable(),
});

/** Upload report's fields. */
export type PatientReportInput = z.infer<typeof patientReportInputSchema>;

/** A report as Report view reads it: the record and who added it. */
export interface PatientReportDetail {
  report: PatientReport;
  /** The member who added it ("Added by"); null when they are unknown. */
  addedBy: string | null;
}

/** One patient's reports, newest first (REPLACE_WITH_API). */
export async function listPatientReports(patientId: string): Promise<PatientReport[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientReports
    .snapshot((report) => report.patientId === patientId)
    .sort((a, b) => compareText(b.date, a.date) || compareText(b.createdAt, a.createdAt));
}

/** One report and who added it — a 404 when it is unknown or deleted (REPLACE_WITH_API). */
export async function fetchPatientReport(id: string): Promise<PatientReportDetail> {
  const { clinicFixtures } = await fixtureWorld();
  const report = await clinicFixtures.patientReports.get(id);
  const [person] = clinicFixtures.staff.snapshot((row) => row.id === report.createdById);
  return {
    report,
    addedBy: person
      ? [person.firstName, person.lastName].filter(Boolean).join(' ')
      : null,
  };
}

/**
 * Upload report (`createReport`, `S:1644`; REPLACE_WITH_API): the record
 * with no files yet — each file is attached as its upload is confirmed. A
 * 422 when the name is blank ("Name the report").
 */
export async function createPatientReport(
  input: PatientReportInput,
): Promise<PatientReport> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(patientReportInputSchema, input);
  await clinicFixtures.patients.get(fields.patientId);
  return clinicFixtures.patientReports.create({ ...fields, files: [] });
}

/**
 * Attach an uploaded file to a report — the storage key the upload tray
 * confirmed (REPLACE_WITH_API). A key already on it is not added twice (the
 * tray's Retry), and a report keeps at most ten files (`S:447`).
 */
export async function attachPatientReportFile(
  reportId: string,
  key: string,
): Promise<PatientReport> {
  const { clinicFixtures } = await fixtureWorld();
  const report = await clinicFixtures.patientReports.get(reportId);
  if (report.files.includes(key)) return report;
  const files = [...report.files, key].slice(0, REPORT_LIMITS.files);
  return clinicFixtures.patientReports.update(reportId, { files });
}

/**
 * Delete a report with the confirm's reason ("Delete this report?", D32;
 * REPLACE_WITH_API): the Reports table's row action — its Undo restores it.
 */
export async function deletePatientReport(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<PatientReport> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientReports.remove(id, reason, note);
}

/** Restore a deleted report — the delete toast's Undo (REPLACE_WITH_API). */
export async function restorePatientReport(id: string): Promise<PatientReport> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientReports.restore(id);
}
