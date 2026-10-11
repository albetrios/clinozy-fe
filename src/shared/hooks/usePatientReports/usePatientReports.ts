import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { FILE_LINK_QUERY_OPTIONS } from '@/shared/api/clinic/file-links.ts';
import {
  createPatientReport,
  deletePatientReport,
  listPatientReports,
  patientReportQueryKeys,
  restorePatientReport,
} from '@/shared/api/clinic/patient-reports-api.ts';
import type {
  PatientReport,
  PatientReportInput,
} from '@/shared/api/clinic/patient-reports-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/**
 * What a report write refreshes: every report read (the section, its dialog, the Overview's card)
 * and the person's activity (the server's `system` entry; `messageQueryKeys`, named here so the
 * hook does not load the messages module).
 */
const REPORT_WRITE_KEYS = [patientReportQueryKeys.all, ['clinic', 'messages']];

/**
 * A patient's reports, newest first, with the server's total (`{ reports, total }`): every page
 * (the Reports table shows them all), or only the newest `limit` (the Overview's card). Idle
 * without a patient or an organization, or with `enabled` false (the member's
 * `patient:clinical_record:read` decides whether the file shows reports at all).
 */
export function usePatientReports(
  patientId: string,
  { limit, enabled = true }: { limit?: number; enabled?: boolean } = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: patientReportQueryKeys.list(organizationId, patientId, limit ?? null),
    queryFn: () => listPatientReports(patientId, limit === undefined ? {} : { limit }),
    // Each file's `file_url` lapses 15 minutes after the read (D86): read again before then
    ...FILE_LINK_QUERY_OPTIONS,
    enabled: enabled && organizationId !== null && patientId !== '',
  });
}

/** Upload report: the patient and the drawer's fields. */
export interface PatientReportCreateVars {
  patientId: string;
  input: PatientReportInput;
}

/**
 * Upload report: the record; the reports refresh. The drawer queues its files — each attached
 * as the upload tray confirms it — and raises "Report uploaded".
 */
export function useCreatePatientReport(
  options: CrudMutationOptions<PatientReport, PatientReportCreateVars> = {},
) {
  return useAppMutation<PatientReport, PatientReportCreateVars>({
    mutationFn: (vars, action) => createPatientReport({ ...vars, ...action }),
    invalidateKeys: REPORT_WRITE_KEYS,
    ...options,
  });
}

/** A report delete: the record and the confirm's reason and note. */
export interface PatientReportDeleteVars {
  report: PatientReport;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a report. No toast of its own: the reason confirm's `undo` raises "Report deleted"
 * with Undo, which runs {@link useRestorePatientReport}.
 */
export function useDeletePatientReport(
  options: CrudMutationOptions<void, PatientReportDeleteVars> = {},
) {
  return useAppMutation<void, PatientReportDeleteVars>({
    mutationFn: ({ report, reason, note }) =>
      deletePatientReport({
        patientId: report.patientId,
        reportId: report.id,
        reason,
        note,
      }),
    invalidateKeys: REPORT_WRITE_KEYS,
    ...options,
  });
}

/** Restore a deleted report (`POST …/restore`) — the delete toast's Undo; silent on success. */
export function useRestorePatientReport(
  options: CrudMutationOptions<PatientReport, PatientReport> = {},
) {
  return useAppMutation<PatientReport, PatientReport>({
    mutationFn: (report, action) =>
      restorePatientReport({
        patientId: report.patientId,
        reportId: report.id,
        ...action,
      }),
    invalidateKeys: REPORT_WRITE_KEYS,
    ...options,
  });
}
