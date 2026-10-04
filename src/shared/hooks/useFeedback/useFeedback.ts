import { keepPreviousData } from '@tanstack/react-query';

import type {
  CheckIn,
  DeleteReason,
  FeedbackAction,
  Review,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  createCheckIn,
  createReview,
  deleteCheckIn,
  deleteReview,
  feedbackQueryKeys,
  fetchCheckIn,
  fetchCheckInContext,
  fetchReview,
  listPatientFeedback,
  logFeedbackAction,
  restoreCheckIn,
  restoreReview,
  updateCheckIn,
  updateReview,
} from '@/shared/api/clinic/feedback-api.ts';
import type {
  CheckInInput,
  CheckInSaved,
  FeedbackActionInput,
  FeedbackType,
  ReviewInput,
  ReviewSaved,
} from '@/shared/api/clinic/feedback-contracts.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { planQueryKeys } from '@/shared/api/clinic/plan-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/**
 * What a feedback write refreshes: every patient read (the cards, the rail's
 * Feedback row, the treatments' Feedback column), the plan a check-in adds
 * to and the tasks a call-back lands in (`S:1648–1650`).
 */
const FEEDBACK_WRITE_KEYS = [patientQueryKeys.all, planQueryKeys.all, taskQueryKeys.all];

/**
 * One page of a patient's feedback of one type (KICKOFF §6.6 Feedback). The
 * last page stays on screen while "Load more" or a type chip reads the next.
 */
export function usePatientFeedback(
  patientId: string,
  {
    type,
    limit,
    enabled = true,
  }: { type: FeedbackType; limit: number; enabled?: boolean },
) {
  return useAppQuery({
    queryKey: feedbackQueryKeys.patient(patientId, type, limit),
    queryFn: () => listPatientFeedback(patientId, { type, limit }),
    enabled: enabled && patientId !== '',
    placeholderData: keepPreviousData,
  });
}

/** One check-in — the edit drawer's read; the dialog route reports a missing one. */
export function useCheckIn(id: string) {
  return useAppQuery({
    queryKey: feedbackQueryKeys.checkIn(id),
    queryFn: () => fetchCheckIn(id),
    enabled: id !== '',
    notifyOnError: false,
  });
}

/** One review — the edit drawer's read; the dialog route reports a missing one. */
export function useReview(id: string) {
  return useAppQuery({
    queryKey: feedbackQueryKeys.review(id),
    queryFn: () => fetchReview(id),
    enabled: id !== '',
    notifyOnError: false,
  });
}

/** The check-in drawer's heading: the last check-in, the treatment, the visit. */
export function useCheckInContext(
  patientId: string,
  {
    appointmentId,
    treatmentId,
    editingId,
  }: {
    appointmentId: string | null;
    treatmentId: string | null;
    editingId: string | null;
  },
) {
  return useAppQuery({
    queryKey: feedbackQueryKeys.context(
      patientId,
      appointmentId ?? '',
      treatmentId ?? '',
      editingId ?? '',
    ),
    queryFn: () =>
      fetchCheckInContext(patientId, { appointmentId, treatmentId, editingId }),
    enabled: patientId !== '',
  });
}

/** Save a new check-in; the drawer raises "Check-in saved for …". */
export function useCreateCheckIn(
  options: CrudMutationOptions<CheckInSaved, CheckInInput> = {},
) {
  return useAppMutation<CheckInSaved, CheckInInput>({
    mutationFn: createCheckIn,
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** A check-in save: the record and its fields. */
export interface CheckInUpdateVars {
  id: string;
  input: CheckInInput;
}

/** Save a check-in's changes; the drawer raises "Check-in updated". */
export function useUpdateCheckIn(
  options: CrudMutationOptions<CheckInSaved, CheckInUpdateVars> = {},
) {
  return useAppMutation<CheckInSaved, CheckInUpdateVars>({
    mutationFn: ({ id, input }) => updateCheckIn(id, input),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** A removal: the record and the confirm's stored reason and note. */
export interface FeedbackDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/** Remove a check-in ("Check-in removed" with Undo). */
export function useDeleteCheckIn(
  options: CrudMutationOptions<CheckIn, FeedbackDeleteVars> = {},
) {
  return useAppMutation<CheckIn, FeedbackDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteCheckIn(id, reason, note),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** Restore a removed check-in — the toast's Undo. */
export function useRestoreCheckIn(options: CrudMutationOptions<CheckIn, string> = {}) {
  return useAppMutation<CheckIn, string>({
    mutationFn: restoreCheckIn,
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** Save a new review; the drawer raises "5★ Google review saved for …". */
export function useCreateReview(
  options: CrudMutationOptions<ReviewSaved, ReviewInput> = {},
) {
  return useAppMutation<ReviewSaved, ReviewInput>({
    mutationFn: createReview,
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** A review save: the record and its fields. */
export interface ReviewUpdateVars {
  id: string;
  input: ReviewInput;
}

/** Save a review's changes; the drawer raises "Review updated". */
export function useUpdateReview(
  options: CrudMutationOptions<ReviewSaved, ReviewUpdateVars> = {},
) {
  return useAppMutation<ReviewSaved, ReviewUpdateVars>({
    mutationFn: ({ id, input }) => updateReview(id, input),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** Remove a review ("Review removed" with Undo). */
export function useDeleteReview(
  options: CrudMutationOptions<Review, FeedbackDeleteVars> = {},
) {
  return useAppMutation<Review, FeedbackDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteReview(id, reason, note),
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** Restore a removed review — the toast's Undo. */
export function useRestoreReview(options: CrudMutationOptions<Review, string> = {}) {
  return useAppMutation<Review, string>({
    mutationFn: restoreReview,
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}

/** Log the follow-up on a card ("✓ Doctor called · logged"). */
export function useLogFeedbackAction(
  options: CrudMutationOptions<FeedbackAction, FeedbackActionInput> = {},
) {
  return useAppMutation<FeedbackAction, FeedbackActionInput>({
    mutationFn: logFeedbackAction,
    invalidateKeys: FEEDBACK_WRITE_KEYS,
    ...options,
  });
}
