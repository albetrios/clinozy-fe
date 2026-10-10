import {
  fetchPatientFile,
  patientFileQueryKeys,
} from '@/shared/api/clinic/patient-file-api.ts';
import { isNotFound } from '@/shared/errors/HttpError.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * One patient's file — the record with their person and the rail facts (KICKOFF §6.6, on
 * clinozy-be). Idle without an id or an organization. A 404 is not retried. No toast of its
 * own: the file says "Patient not found" and goes back to the list on a 404,
 * and raises the list-error toast with Retry on any other failure
 * (`useListLoadError`).
 */
export function usePatientFile(patientId: string | undefined) {
  const organizationId = useOrganizationStore((state) => state.organizationId);
  return useAppQuery({
    queryKey: patientFileQueryKeys.detail(organizationId, patientId ?? ''),
    queryFn: () => fetchPatientFile(patientId ?? ''),
    enabled: Boolean(patientId) && organizationId !== null,
    retry: (failures, error) => !isNotFound(error) && failures < 2,
    // The file renders this failure itself (see above).
    notifyOnError: false,
  });
}
