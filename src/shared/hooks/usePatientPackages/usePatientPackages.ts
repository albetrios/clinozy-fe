import {
  addPatientPackage,
  type AddPatientPackageInput,
  consumePackageSession,
  listPackageOfferings,
  listPatientPackages,
  patientPackageQueryKeys,
} from '@/shared/api/clinic/patient-packages-api.ts';
import type { PatientPackageRecord } from '@/shared/api/clinic/patient-packages-contracts.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/** One patient's packages with their offerings (KICKOFF §6.6); idle without a patient. */
export function usePatientPackages(patientId: string, { enabled = true } = {}) {
  return useAppQuery({
    queryKey: patientPackageQueryKeys.patient(patientId),
    queryFn: () => listPatientPackages(patientId),
    enabled: enabled && patientId !== '',
  });
}

/** The offerings Add package lists: the active ones of more than one session. */
export function usePackageOfferings({ enabled = true } = {}) {
  return useAppQuery({
    queryKey: patientPackageQueryKeys.offerings(),
    queryFn: listPackageOfferings,
    enabled,
  });
}

/**
 * Add package (A-F6): an uninvoiced package; refreshes every patient read.
 * The drawer raises "Package added · invoice it from Invoices".
 */
export function useAddPatientPackage(
  options: CrudMutationOptions<PatientPackageRecord, AddPatientPackageInput> = {},
) {
  return useAppMutation<PatientPackageRecord, AddPatientPackageInput>({
    mutationFn: addPatientPackage,
    invalidateKeys: [patientQueryKeys.all],
    ...options,
  });
}

/**
 * Use a session of a package — the card's "Use a session"; refreshes every
 * patient read. The card raises "Session 2 of 7 used" (or "No sessions left").
 */
export function useConsumePackageSession(
  options: CrudMutationOptions<PatientPackageRecord, string> = {},
) {
  return useAppMutation<PatientPackageRecord, string>({
    mutationFn: consumePackageSession,
    invalidateKeys: [patientQueryKeys.all],
    ...options,
  });
}
