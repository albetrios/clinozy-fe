import type { PatientReport } from '@/shared/api/clinic/clinic-schema.ts';
import {
  createPatientReport,
  fetchPatientReport,
  listPatientReports,
  type PatientReportInput,
  patientReportQueryKeys,
} from '@/shared/api/clinic/patient-reports-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/** One patient's reports, newest first (KICKOFF §6.6); idle without a patient. */
export function usePatientReports(patientId: string, { enabled = true } = {}) {
  return useAppQuery({
    queryKey: patientReportQueryKeys.patient(patientId),
    queryFn: () => listPatientReports(patientId),
    enabled: enabled && patientId !== '',
  });
}

/**
 * One report and who added it — Report view's read. No toast when it fails:
 * the dialog route turns a missing record into "Report not found".
 */
export function usePatientReport(id: string) {
  return useAppQuery({
    queryKey: patientReportQueryKeys.detail(id),
    queryFn: () => fetchPatientReport(id),
    enabled: id !== '',
    notifyOnError: false,
  });
}

/**
 * Upload report: the record; refreshes every patient read (the reports and
 * the file's counts). The drawer queues its files — each attached as the
 * upload tray confirms it — and raises "Report uploaded".
 */
export function useCreatePatientReport(
  options: CrudMutationOptions<PatientReport, PatientReportInput> = {},
) {
  return useAppMutation<PatientReport, PatientReportInput>({
    mutationFn: createPatientReport,
    invalidateKeys: [patientQueryKeys.all],
    ...options,
  });
}
