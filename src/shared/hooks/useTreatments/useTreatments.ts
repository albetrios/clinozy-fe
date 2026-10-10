import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import {
  createTreatment,
  listPatientTreatments,
  listTreatmentCheckIns,
  listVisitTreatmentsToBill,
  reverseTreatment,
  treatmentQueryKeys,
  updateTreatment,
} from '@/shared/api/clinic/treatments-api.ts';
import type {
  TreatmentCreateInput,
  TreatmentFields,
  TreatmentRecord,
} from '@/shared/api/clinic/treatments-contracts.ts';
import { VISIT_WRITE_KEYS } from '@/shared/api/clinic/visits-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/**
 * What a treatment write refreshes: every patient read (the sessions, the packages whose sessions
 * the server spends or gives back, the file's conversion on a first session), the person's
 * activity (the server's `system` entry) and the tasks (the aftercare call follows the session).
 */
const TREATMENT_WRITE_KEYS = [
  patientQueryKeys.all,
  // The person's thread (`messageQueryKeys`), named here so the hook does not load the
  // messages module — it still reads the fixture world.
  ['clinic', 'messages'],
  taskQueryKeys.all,
];

// ── Reads ──

/**
 * A visit's sessions still to bill, oldest first (`GET …/treatments?appointment_id=
 * &is_billed=false`) — the Invoice drawer's "Create invoice from visit"; idle without a patient
 * and a visit.
 */
export function useVisitTreatmentsToBill(
  patientId: string | null,
  appointmentId: string | null,
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: treatmentQueryKeys.toBill(
      organizationId,
      patientId ?? '',
      appointmentId ?? '',
    ),
    queryFn: () => listVisitTreatmentsToBill(patientId ?? '', appointmentId ?? ''),
    enabled: Boolean(patientId) && Boolean(appointmentId) && organizationId !== null,
  });
}

/**
 * One patient's sessions, newest first, reversed ones included (`GET …/treatments`, every page);
 * idle without a patient or an organization, or while `enabled` is false — a reader without
 * `patient_treatment:read` passes it.
 */
export function usePatientTreatments(
  patientId: string,
  {
    enabled = true,
    notifyOnError = true,
  }: {
    enabled?: boolean;
    /** Off where the screen shows the failure in place (the Treatments section's Retry). */
    notifyOnError?: boolean;
  } = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: treatmentQueryKeys.patient(organizationId, patientId),
    queryFn: () => listPatientTreatments(patientId),
    enabled: enabled && patientId !== '' && organizationId !== null,
    notifyOnError,
  });
}

/**
 * A session's check-ins, newest first — the edit drawer's "Feedback on this treatment"; idle
 * without a session. The drawer shows the line in place, so a failure there is quiet.
 */
export function useTreatmentFeedback(patientId: string, treatmentId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: treatmentQueryKeys.checkIns(organizationId, patientId, treatmentId ?? ''),
    queryFn: () => listTreatmentCheckIns(patientId, treatmentId ?? ''),
    enabled: treatmentId !== null && patientId !== '' && organizationId !== null,
    // The drawer says "No check-in yet" while it has none; nothing else waits on it.
    notifyOnError: false,
  });
}

// ── Writes ──

/** What a new session sends: whose it is and its fields. */
export interface TreatmentCreateVars {
  patientId: string;
  input: TreatmentCreateInput;
}

/**
 * Record a session — not optimistic (the drawer shows "Saving…"); the caller raises its toast
 * ("Treatment saved", "Session 2 added"). One for a package spends a session of it on the server.
 */
export function useCreateTreatment(
  options: CrudMutationOptions<TreatmentRecord, TreatmentCreateVars> = {},
) {
  return useAppMutation<TreatmentRecord, TreatmentCreateVars>({
    mutationFn: ({ patientId, input }, action) =>
      createTreatment({ patientId, input, ...action }),
    // A session at the patient's open visit: the visit flow and Today's floor read it again.
    invalidateKeys: [...TREATMENT_WRITE_KEYS, ...VISIT_WRITE_KEYS],
    ...options,
  });
}

/** A session save: the session as the drawer read it, and its fields. */
export interface TreatmentUpdateVars {
  treatment: TreatmentRecord;
  fields: TreatmentFields;
}

/**
 * Save a session's changes — refused when someone saved it meanwhile (`409 record_changed`, the
 * drawer's Reload) or once it is reversed. No toast of its own: the drawer raises "Treatment saved".
 */
export function useUpdateTreatment(
  options: CrudMutationOptions<TreatmentRecord, TreatmentUpdateVars> = {},
) {
  return useAppMutation<TreatmentRecord, TreatmentUpdateVars>({
    mutationFn: ({ treatment, fields }, action) =>
      updateTreatment({ treatment, fields, ...action }),
    invalidateKeys: TREATMENT_WRITE_KEYS,
    ...options,
  });
}

/** A reverse: the session and the reason the confirm composed. */
export interface TreatmentReverseVars {
  treatment: TreatmentRecord;
  reason: string;
}

/**
 * Reverse a session (in place of the design's delete + Undo): the row stays, marked reversed, and
 * a package session it spent comes back. Final, so its toast — the caller's — has no Undo (Q7).
 */
export function useReverseTreatment(
  options: CrudMutationOptions<TreatmentRecord, TreatmentReverseVars> = {},
) {
  return useAppMutation<TreatmentRecord, TreatmentReverseVars>({
    mutationFn: ({ treatment, reason }, action) =>
      reverseTreatment({ treatment, reason, ...action }),
    invalidateKeys: TREATMENT_WRITE_KEYS,
    ...options,
  });
}
