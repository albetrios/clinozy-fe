import {
  fetchPatientFile,
  patientFileQueryKeys,
} from '@/shared/api/clinic/patient-file-api.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

/** A 404 — the patient is unknown or deleted; asking again won't change it. */
export function isPatientFileMissing(error: unknown): boolean {
  return isHttpError(error) && error.status === 404;
}

/**
 * One patient's file — the record and the rail facts (`getPatient`, `S:1629`;
 * KICKOFF §6.6). Idle without an id. A 404 is not retried. No toast of its
 * own: the file says "Patient not found" and goes back to the list on a 404,
 * and raises the list-error toast with Retry on any other failure
 * (`useListLoadError`).
 */
export function usePatientFile(patientId: string | undefined) {
  return useAppQuery({
    queryKey: patientFileQueryKeys.detail(patientId ?? ''),
    queryFn: () => fetchPatientFile(patientId ?? ''),
    enabled: Boolean(patientId),
    retry: (failures, error) => !isPatientFileMissing(error) && failures < 2,
    // The file renders this failure itself (see above).
    notifyOnError: false,
  });
}
