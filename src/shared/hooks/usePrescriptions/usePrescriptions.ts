import type { DeleteReason, Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import {
  createPrescription,
  deletePrescription,
  fetchPrescription,
  fetchRxCatalog,
  fetchRxSheetContext,
  listPatientPrescriptions,
  type PrescriptionInput,
  prescriptionQueryKeys,
  restorePrescription,
  updatePrescription,
} from '@/shared/api/clinic/prescriptions-api.ts';
import { VISIT_WRITE_KEYS } from '@/shared/api/clinic/visits-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/**
 * What a prescription write refreshes: every patient read — the prescriptions
 * sit under it, and the file's section counts read them.
 */
const RX_WRITE_KEYS = [patientQueryKeys.all];

/** One patient's prescriptions, newest first (KICKOFF §6.6); idle without a patient. */
export function usePatientPrescriptions(patientId: string, { enabled = true } = {}) {
  return useAppQuery({
    queryKey: prescriptionQueryKeys.patient(patientId),
    queryFn: () => listPatientPrescriptions(patientId),
    enabled: enabled && patientId !== '',
  });
}

/**
 * One prescription — the edit drawer's and the print preview's read. No toast
 * when it fails: the dialog route turns a missing record into "Prescription
 * not found" and goes back to the section.
 */
export function usePrescription(id: string) {
  return useAppQuery({
    queryKey: prescriptionQueryKeys.detail(id),
    queryFn: () => fetchPrescription(id),
    enabled: id !== '',
    notifyOnError: false,
  });
}

/** The Rx drawer's medicines, with this patient's last line of each (H:4806). */
export function useRxCatalog(patientId: string) {
  return useAppQuery({
    queryKey: prescriptionQueryKeys.catalog(patientId),
    queryFn: () => fetchRxCatalog(patientId),
    enabled: patientId !== '',
  });
}

/** What the printed sheet needs beyond the Rx: the patient, doctor, clinic and branch. */
export function useRxSheetContext(patientId: string, doctorId: string | null) {
  return useAppQuery({
    queryKey: prescriptionQueryKeys.sheet(patientId, doctorId),
    queryFn: () => fetchRxSheetContext(patientId, doctorId),
    enabled: patientId !== '',
  });
}

/**
 * Write a prescription; the drawer raises "Prescription saved". Written at
 * the patient's open visit, it moves the visit on — the visits and Today's
 * floor are read again.
 */
export function useCreatePrescription(
  options: CrudMutationOptions<Prescription, PrescriptionInput> = {},
) {
  return useAppMutation<Prescription, PrescriptionInput>({
    mutationFn: createPrescription,
    invalidateKeys: [...RX_WRITE_KEYS, ...VISIT_WRITE_KEYS],
    ...options,
  });
}

/** A prescription save: the record and its fields. */
export interface PrescriptionUpdateVars {
  id: string;
  input: PrescriptionInput;
}

/** Save a prescription's changes; the drawer raises "Prescription #500 saved". */
export function useUpdatePrescription(
  options: CrudMutationOptions<Prescription, PrescriptionUpdateVars> = {},
) {
  return useAppMutation<Prescription, PrescriptionUpdateVars>({
    mutationFn: ({ id, input }) => updatePrescription(id, input),
    invalidateKeys: RX_WRITE_KEYS,
    ...options,
  });
}

/** A prescription delete: the record and the confirm's stored reason and note. */
export interface PrescriptionDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a prescription. No toast of its own: the reason confirm's `undo`
 * raises "Prescription deleted" with Undo, which runs {@link useRestorePrescription}.
 */
export function useDeletePrescription(
  options: CrudMutationOptions<Prescription, PrescriptionDeleteVars> = {},
) {
  return useAppMutation<Prescription, PrescriptionDeleteVars>({
    mutationFn: ({ id, reason, note }) => deletePrescription(id, reason, note),
    invalidateKeys: RX_WRITE_KEYS,
    ...options,
  });
}

/** Put a deleted prescription back — the Undo of its toast (D32); silent on success. */
export function useRestorePrescription(
  options: CrudMutationOptions<Prescription, string> = {},
) {
  return useAppMutation<Prescription, string>({
    mutationFn: restorePrescription,
    invalidateKeys: RX_WRITE_KEYS,
    ...options,
  });
}
