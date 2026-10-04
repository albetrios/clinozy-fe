import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { commandSearchQueryKeys } from '@/shared/api/clinic/command-search-api.ts';
import {
  createPatient,
  deletePatient,
  fetchPatient,
  findPatientByPhone,
  listPatients,
  patientQueryKeys,
  restorePatient,
  updatePatient,
} from '@/shared/api/clinic/patients-api.ts';
import type {
  PatientCreateInput,
  PatientCreateResult,
  PatientListParams,
  PatientPatch,
  PatientRecord,
  PatientRow,
} from '@/shared/api/clinic/patients-contracts.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';

/**
 * What a patient write refreshes: every patient read, and ⌘K's patient
 * results (a name, a mobile or a removal changes what the search finds).
 */
const PATIENT_WRITE_KEYS = [patientQueryKeys.all, commandSearchQueryKeys.all];

// ── Reads ──

/**
 * The Patients list, a cursor page of 50 at a time (D7, `S:1619`) — the room's
 * infinite scroll. The params come from the URL (`patientListParamsOf`); while
 * new ones load, the previous rows stay on screen (`isRefreshing`). A failed
 * read raises no toast here: the room keeps the last copy and offers Retry
 * (KICKOFF §6.0 List error).
 */
export function usePatientList(params: PatientListParams) {
  return useCursorList<PatientRow>({
    queryKey: patientQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listPatients(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
    notifyOnError: false,
  });
}

/** One patient by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function usePatient(id: string | undefined) {
  return useAppQuery({
    queryKey: patientQueryKeys.detail(id ?? ''),
    queryFn: () => fetchPatient(id ?? ''),
    enabled: Boolean(id),
  });
}

/**
 * The patient already on a mobile (Q-P7) — the drawer asks once the Mobile
 * field loses focus with ten digits; idle while `phone` is null. A failed
 * lookup shows no notice, so it raises no toast either.
 */
export function usePatientByPhone(phone: string | null, exceptId: string | null) {
  return useAppQuery({
    queryKey: patientQueryKeys.byPhone(phone ?? '', exceptId),
    queryFn: () => findPatientByPhone(phone ?? '', exceptId),
    enabled: phone !== null,
    notifyOnError: false,
  });
}

// ── Writes ──

/**
 * Create a patient — not optimistic (the drawer shows "Saving…"). The list
 * refetches with the new patient first (D28) and the Tasks list picks up the
 * onboarding task. No toast of its own: the full drawer says "Patient #3509
 * created · onboarding task added" with "Open file", the quick-add "<name>
 * registered as patient #3509" (KICKOFF §6.5).
 */
export function useCreatePatient(
  options: CrudMutationOptions<PatientCreateResult, PatientCreateInput> = {},
) {
  return useAppMutation<PatientCreateResult, PatientCreateInput>({
    mutationFn: createPatient,
    invalidateKeys: [...PATIENT_WRITE_KEYS, taskQueryKeys.all],
    ...options,
  });
}

/** What a patient save sends. */
export interface PatientUpdateVars {
  id: string;
  patch: PatientPatch;
}

/** Save a patient — not optimistic; the drawer names the patient in its toast ("Priya Shah saved"). */
export function useUpdatePatient(
  options: CrudMutationOptions<PatientRecord, PatientUpdateVars> = {},
) {
  return useAppMutation<PatientRecord, PatientUpdateVars>({
    mutationFn: ({ id, patch }) => updatePatient(id, patch),
    invalidateKeys: PATIENT_WRITE_KEYS,
    ...options,
  });
}

/** What a confirmed patient delete sends: the record and the Reason confirm's choice. */
export interface PatientDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Remove a patient (`S:1546`) — optimistic: the row leaves every cached list
 * page at once and comes back if the write fails. No toast of its own: the
 * Reason confirm's `reason.undo` shows "<name> removed" with Undo, which runs
 * {@link useRestorePatient}.
 */
export function useDeletePatient(
  options: CrudMutationOptions<PatientRecord, PatientDeleteVars> = {},
) {
  return useAppMutation<PatientRecord, PatientDeleteVars, unknown, PatientRow>({
    mutationFn: ({ id, reason, note }) => deletePatient(id, reason, note),
    invalidateKeys: PATIENT_WRITE_KEYS,
    optimisticInfinite: {
      queryKey: patientQueryKeys.lists(),
      update: (rows, { id }) => rows.filter((patient) => patient.id !== id),
    },
    ...options,
  });
}

/** Put a removed patient back — the Undo of its "removed" toast (10s, D32); silent on success. */
export function useRestorePatient(
  options: CrudMutationOptions<PatientRecord, string> = {},
) {
  return useAppMutation<PatientRecord, string>({
    mutationFn: restorePatient,
    invalidateKeys: PATIENT_WRITE_KEYS,
    ...options,
  });
}
