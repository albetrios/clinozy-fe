import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { commandSearchQueryKeys } from '@/shared/api/clinic/command-search-api.ts';
import {
  contactQueryKeys,
  findContactByPhone,
} from '@/shared/api/clinic/contacts-api.ts';
import { leadQueryKeys } from '@/shared/api/clinic/leads-api.ts';
import {
  createPatient,
  deletePatient,
  fetchPatient,
  listPatients,
  patientQueryKeys,
  restorePatient,
  updatePatient,
} from '@/shared/api/clinic/patients-api.ts';
import type {
  PatientFields,
  PatientListParams,
  PatientPersonInput,
  PatientRecord,
  PatientRow,
} from '@/shared/api/clinic/patients-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/**
 * What a patient write refreshes: every patient read, the people (a name or a number is the
 * contact's), their leads (a new file converts the lead) and ⌘K's results.
 */
const PATIENT_WRITE_KEYS = [
  patientQueryKeys.all,
  contactQueryKeys.all,
  leadQueryKeys.all,
  commandSearchQueryKeys.all,
];

// ── Reads ──

/**
 * The Patients list, 50 rows a page (`GET /app/patients`, each page joined with its people) —
 * the room's infinite scroll, for the URL's params; while new ones load the previous rows stay
 * on screen (`isRefreshing`). A failed read raises no toast here: the room keeps the last copy
 * and offers Retry.
 */
export function usePatientList(params: PatientListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<PatientRow>({
    queryKey: patientQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listPatients(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** One patient with their person; idle while there is no id. A deleted or unknown id is a 404. */
export function usePatient(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: patientQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchPatient(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

/**
 * The person already on a number (E.164) — the drawer asks once the Mobile field has ten
 * digits; idle while `phone` is null. Their `patientId` says whether they have a file. A failed
 * lookup shows no notice, so it raises no toast either.
 */
export function usePersonByPhone(phone: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: patientQueryKeys.byPhone(organizationId, phone ?? ''),
    queryFn: () => findContactByPhone(phone ?? ''),
    enabled: phone !== null && organizationId !== null,
    notifyOnError: false,
  });
}

// ── Writes ──

/** What a create sends: the drawer's fields and who the patient is. */
export interface PatientCreateVars {
  fields: PatientFields;
  person: PatientPersonInput;
}

/**
 * Create a patient — not optimistic (the drawer shows "Saving…"); the list refetches with the
 * new patient first (D28). No toast of its own: the full drawer says "Patient #3509 created"
 * with "Open file".
 */
export function useCreatePatient(
  options: CrudMutationOptions<PatientRecord, PatientCreateVars> = {},
) {
  return useAppMutation<PatientRecord, PatientCreateVars>({
    mutationFn: (vars, action) => createPatient({ ...vars, ...action }),
    invalidateKeys: PATIENT_WRITE_KEYS,
    ...options,
  });
}

/** What a patient save sends: the record as read and the drawer's fields. */
export interface PatientUpdateVars {
  record: PatientRecord;
  fields: PatientFields;
}

/**
 * Save a patient — not optimistic; the person's change and the file's, each refused when
 * someone saved it meanwhile (`409 record_changed`). The drawer names the patient in its toast
 * ("Priya Shah saved").
 */
export function useUpdatePatient(
  options: CrudMutationOptions<PatientRecord, PatientUpdateVars> = {},
) {
  return useAppMutation<PatientRecord, PatientUpdateVars>({
    mutationFn: (vars, action) => updatePatient({ ...vars, ...action }),
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
 * Remove a patient — optimistic: the row leaves every cached list page at once and comes back
 * if the write fails. The lists refresh — not the patient's own read, which would answer 404
 * while their file closes. No toast of its own: the Reason confirm's "removed" with Undo runs
 * {@link useRestorePatient}.
 */
export function useDeletePatient(
  options: CrudMutationOptions<void, PatientDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, PatientDeleteVars, unknown, PatientRow>({
    mutationFn: ({ id, reason, note }) => deletePatient({ patientId: id, reason, note }),
    invalidateKeys: [patientQueryKeys.lists(organizationId), commandSearchQueryKeys.all],
    optimisticInfinite: {
      queryKey: patientQueryKeys.lists(organizationId),
      update: (rows, { id }) => rows.filter((patient) => patient.id !== id),
    },
    ...options,
  });
}

/** Put a removed patient back — the Undo of its "removed" toast; silent on success. */
export function useRestorePatient(
  options: CrudMutationOptions<PatientRecord, string> = {},
) {
  return useAppMutation<PatientRecord, string>({
    mutationFn: (id, action) => restorePatient(id, action.idempotencyKey),
    invalidateKeys: PATIENT_WRITE_KEYS,
    ...options,
  });
}
