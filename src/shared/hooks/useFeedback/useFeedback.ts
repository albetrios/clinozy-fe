import type { QueryKey } from '@tanstack/react-query';

import type { DeleteReason, FeedbackActionKind } from '@/shared/api/app/app-schema.ts';
import {
  createCheckIn,
  createReview,
  deleteFeedback,
  feedbackQueryKeys,
  fetchPreviousCheckIn,
  listPatientFeedback,
  logFeedbackAction,
  restoreFeedback,
  updateCheckIn,
  updateReview,
} from '@/shared/api/app/feedback-api.ts';
import {
  type CheckInContext,
  type CheckInCreateInput,
  type CheckInFields,
  checkInOfferingsOf,
  type FeedbackKind,
  type PatientCheckIn,
  type PatientReview,
  type ReviewCreateInput,
  type ReviewFields,
} from '@/shared/api/app/feedback-contracts.ts';
import { patientFileQueryKeys } from '@/shared/api/app/patient-file-api.ts';
import { planQueryKeys } from '@/shared/api/app/plan-api.ts';
import { taskQueryKeys } from '@/shared/api/app/tasks-api.ts';
import { fetchTreatment, treatmentQueryKeys } from '@/shared/api/app/treatments-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppointment } from '@/shared/hooks/useAppointments/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/**
 * What a feedback write refreshes: the cards, the file's rail (its latest feedback and counts),
 * the treatments (a session's latest check-in and "Feedback on this treatment") and the tasks
 * (the call-back a bad one opens, TR4).
 */
const FEEDBACK_WRITE_KEYS: QueryKey[] = [
  feedbackQueryKeys.all,
  patientFileQueryKeys.all,
  treatmentQueryKeys.all,
  taskQueryKeys.all,
];

/**
 * A new one also writes a `system` entry to the person's thread (`messageQueryKeys`, named
 * here so the hook does not load the messages module — it still reads the fixture world).
 */
const FEEDBACK_CREATE_KEYS: QueryKey[] = [...FEEDBACK_WRITE_KEYS, ['app', 'messages']];

/** A new check-in's next offerings land in the plan (TR10) — the suggestions refresh too. */
const CHECK_IN_CREATE_KEYS: QueryKey[] = [...FEEDBACK_CREATE_KEYS, planQueryKeys.all];

// ── Reads ──

/**
 * Every check-in and review of a patient, newest first — the Feedback card; idle until it opens.
 * A failure shows in the card, not as a toast.
 */
export function usePatientFeedback(patientId: string, { enabled = true } = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: feedbackQueryKeys.patient(organizationId, patientId),
    queryFn: () => listPatientFeedback(patientId),
    enabled: enabled && patientId !== '' && organizationId !== null,
    notifyOnError: false,
  });
}

/**
 * The check-in drawer's head (H:4396), from the routes that exist: the patient's check-in
 * before this one (`…/check-ins`), the treatment an aftercare one follows (its `GET`) and the
 * visit it was taken at (the booking's `GET`). Each part goes without when its read fails.
 */
export function useCheckInContext(
  patientId: string,
  {
    appointmentId,
    treatmentId,
    editing,
  }: {
    appointmentId: string | null;
    treatmentId: string | null;
    editing: PatientCheckIn | null;
  },
): CheckInContext {
  const organizationId = useOrganizationId();
  const ready = patientId !== '' && organizationId !== null;
  const previous = useAppQuery({
    queryKey: feedbackQueryKeys.previous(organizationId, patientId, editing?.id ?? ''),
    queryFn: () => fetchPreviousCheckIn(patientId, editing),
    enabled: ready,
    notifyOnError: false,
  });
  // The Treatment drawer's read of the same session (`patient_treatment:read`).
  const treatment = useAppQuery({
    queryKey: treatmentQueryKeys.detail(organizationId, patientId, treatmentId ?? ''),
    queryFn: () => fetchTreatment(patientId, treatmentId ?? ''),
    enabled: ready && treatmentId !== null,
    notifyOnError: false,
  });
  const visit = useAppointment(appointmentId ?? undefined);
  return {
    previous: previous.data ?? null,
    treatmentName: treatment.data?.name ?? null,
    visitService: visit.data?.serviceLabel || null, // NOSONAR(S6606): a blank service is none
  };
}

/**
 * The offerings a new check-in can put in the plan, A to Z — out of the one offerings catalogue
 * (`useOfferings`), taken as fresh for a few minutes and refreshed by any offering write. Quiet
 * on failure: the picker shows its own "couldn't load" line.
 */
export function useCheckInOfferings() {
  return useOfferings({
    select: checkInOfferingsOf,
    staleTime: 5 * 60_000,
    notifyOnError: false,
  });
}

// ── Writes ──

/** A new check-in: the patient and what it says. */
export interface CheckInCreateVars {
  patientId: string;
  input: CheckInCreateInput;
}

/** Log a check-in; the drawer raises "Check-in saved for …". */
export function useCreateCheckIn(
  options: CrudMutationOptions<PatientCheckIn, CheckInCreateVars> = {},
) {
  return useAppMutation<PatientCheckIn, CheckInCreateVars>({
    mutationFn: (vars, action) => createCheckIn({ ...vars, ...action }),
    invalidateKeys: CHECK_IN_CREATE_KEYS,
    ...options,
  });
}

/** A check-in save: the record as the drawer read it, and its fields. */
export interface CheckInUpdateVars {
  checkIn: PatientCheckIn;
  fields: CheckInFields;
}

/** Save a check-in's changes, refused when someone saved it meanwhile; "Check-in updated". */
export function useUpdateCheckIn(
  options: CrudMutationOptions<PatientCheckIn, CheckInUpdateVars> = {},
) {
  return useAppMutation<PatientCheckIn, CheckInUpdateVars>({
    mutationFn: ({ checkIn, fields }, action) =>
      updateCheckIn({
        patientId: checkIn.patientId,
        checkInId: checkIn.id,
        fields,
        expectedUpdatedAt: checkIn.updatedAt,
        ...action,
      }),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** A new review: the patient and what it says. */
export interface ReviewCreateVars {
  patientId: string;
  input: ReviewCreateInput;
}

/** Log a review; the drawer raises "5★ Google review saved for …". */
export function useCreateReview(
  options: CrudMutationOptions<PatientReview, ReviewCreateVars> = {},
) {
  return useAppMutation<PatientReview, ReviewCreateVars>({
    mutationFn: (vars, action) => createReview({ ...vars, ...action }),
    invalidateKeys: FEEDBACK_CREATE_KEYS,
    ...options,
  });
}

/** A review save: the record as the drawer read it, and its fields. */
export interface ReviewUpdateVars {
  review: PatientReview;
  fields: ReviewFields;
}

/** Save a review's changes, refused when someone saved it meanwhile; "Review updated". */
export function useUpdateReview(
  options: CrudMutationOptions<PatientReview, ReviewUpdateVars> = {},
) {
  return useAppMutation<PatientReview, ReviewUpdateVars>({
    mutationFn: ({ review, fields }, action) =>
      updateReview({
        patientId: review.patientId,
        reviewId: review.id,
        fields,
        expectedUpdatedAt: review.updatedAt,
        ...action,
      }),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** One card: whose it is, which of the two, which one. */
export interface FeedbackRecordVars {
  patientId: string;
  kind: FeedbackKind;
  id: string;
}

/** A removal: the card and the confirm's reason and note. */
export interface FeedbackDeleteVars extends FeedbackRecordVars {
  reason: DeleteReason;
  note: string | null;
}

/** Remove a check-in or a review; the confirm raises "… removed" with Undo. */
export function useDeleteFeedback(
  options: CrudMutationOptions<void, FeedbackDeleteVars> = {},
) {
  return useAppMutation<void, FeedbackDeleteVars>({
    mutationFn: deleteFeedback,
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** Bring a removed check-in or review back — the toast's Undo. */
export function useRestoreFeedback(
  options: CrudMutationOptions<void, FeedbackRecordVars> = {},
) {
  return useAppMutation<void, FeedbackRecordVars>({
    mutationFn: (vars, action) => restoreFeedback({ ...vars, ...action }),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** A follow-up: the card and what was done. */
export interface FeedbackActionVars extends FeedbackRecordVars {
  action: FeedbackActionKind;
}

/** Log the follow-up on a card ("✓ Doctor called · logged") — no way back (Q7). */
export function useLogFeedbackAction(
  options: CrudMutationOptions<void, FeedbackActionVars> = {},
) {
  return useAppMutation<void, FeedbackActionVars>({
    mutationFn: (vars, action) => logFeedbackAction({ ...vars, note: null, ...action }),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}
