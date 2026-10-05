import type { DeleteReason, Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import {
  createTreatment,
  deleteTreatment,
  fetchTreatment,
  listPatientTreatments,
  listTreatmentCheckIns,
  restoreTreatment,
  type TreatmentInput,
  treatmentQueryKeys,
  updateTreatment,
} from '@/shared/api/clinic/treatments-api.ts';
import { VISIT_WRITE_KEYS } from '@/shared/api/clinic/visits-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/**
 * What a treatment write refreshes: every patient read (the treatments, the
 * packages whose sessions it counts, the file's counts) and the tasks — the
 * aftercare call follows the treatment (`S:1642`).
 */
const TREATMENT_WRITE_KEYS = [patientQueryKeys.all, taskQueryKeys.all];

/** One patient's treatments, newest first (KICKOFF §6.6); idle without a patient. */
export function usePatientTreatments(patientId: string, { enabled = true } = {}) {
  return useAppQuery({
    queryKey: treatmentQueryKeys.patient(patientId),
    queryFn: () => listPatientTreatments(patientId),
    enabled: enabled && patientId !== '',
  });
}

/** Each of a patient's treatments' latest check-in — the Treatments table's Feedback. */
export function useTreatmentCheckIns(patientId: string) {
  return useAppQuery({
    queryKey: treatmentQueryKeys.checkIns(patientId),
    queryFn: () => listTreatmentCheckIns(patientId),
    enabled: patientId !== '',
  });
}

/**
 * One treatment and its check-ins — the edit drawer's read. No toast when it
 * fails: the dialog route turns a missing record into "Treatment not found".
 */
export function useTreatment(id: string) {
  return useAppQuery({
    queryKey: treatmentQueryKeys.detail(id),
    queryFn: () => fetchTreatment(id),
    enabled: id !== '',
    notifyOnError: false,
  });
}

/** Record a treatment; the drawer raises "Treatment saved". */
export function useCreateTreatment(
  options: CrudMutationOptions<Treatment, TreatmentInput> = {},
) {
  return useAppMutation<Treatment, TreatmentInput>({
    mutationFn: createTreatment,
    // Today's session at the patient's open visit moves it to Checkout.
    invalidateKeys: [...TREATMENT_WRITE_KEYS, ...VISIT_WRITE_KEYS],
    ...options,
  });
}

/** A treatment save: the record and its fields. */
export interface TreatmentUpdateVars {
  id: string;
  input: TreatmentInput;
}

/** Save a treatment's changes. */
export function useUpdateTreatment(
  options: CrudMutationOptions<Treatment, TreatmentUpdateVars> = {},
) {
  return useAppMutation<Treatment, TreatmentUpdateVars>({
    mutationFn: ({ id, input }) => updateTreatment(id, input),
    invalidateKeys: TREATMENT_WRITE_KEYS,
    ...options,
  });
}

/** A treatment delete: the record and the confirm's stored reason and note. */
export interface TreatmentDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete a treatment. No toast of its own: the reason confirm's `undo` raises
 * "Treatment deleted" with Undo, which runs {@link useRestoreTreatment}.
 */
export function useDeleteTreatment(
  options: CrudMutationOptions<Treatment, TreatmentDeleteVars> = {},
) {
  return useAppMutation<Treatment, TreatmentDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteTreatment(id, reason, note),
    invalidateKeys: TREATMENT_WRITE_KEYS,
    ...options,
  });
}

/** Put a deleted treatment back — the Undo of its toast (D32); silent on success. */
export function useRestoreTreatment(
  options: CrudMutationOptions<Treatment, string> = {},
) {
  return useAppMutation<Treatment, string>({
    mutationFn: restoreTreatment,
    invalidateKeys: TREATMENT_WRITE_KEYS,
    ...options,
  });
}
