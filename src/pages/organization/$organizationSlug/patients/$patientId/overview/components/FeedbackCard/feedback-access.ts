import type { FeedbackItem } from '@/shared/api/app/feedback-contracts.ts';

/**
 * What the member may do with a patient's feedback. Check-ins are part of the file
 * (`patient:update`); reviews have their own codes (clinozy-be D83 (4)) — so Marketing logs the
 * reviews patients give without changing the file, and the roles that change the file keep
 * logging them.
 */
export interface FeedbackAccess {
  /** Log, edit and remove a check-in, and log its follow-ups (`patient:update`). */
  checkIns: boolean;
  /** Log a review (`patient_review:create`). */
  logReview: boolean;
  /** Edit a review and log what was done about it (`patient_review:update`). */
  editReview: boolean;
  /** Remove a review (`patient_review:delete`). */
  removeReview: boolean;
}

/** Feedback for a member who may only read it. */
export const READ_ONLY_FEEDBACK: FeedbackAccess = {
  checkIns: false,
  logReview: false,
  editReview: false,
  removeReview: false,
};

/** Whether "Log feedback" has anything to offer — a check-in or a review. */
export function canLogFeedback(access: FeedbackAccess): boolean {
  return access.checkIns || access.logReview;
}

/** What one card offers: Edit and its follow-ups, and Remove — each by its kind's codes. */
export function feedbackItemAccess(
  item: Pick<FeedbackItem, 'kind'>,
  access: FeedbackAccess,
): { canEdit: boolean; canRemove: boolean } {
  return item.kind === 'checkIn'
    ? { canEdit: access.checkIns, canRemove: access.checkIns }
    : { canEdit: access.editReview, canRemove: access.removeReview };
}
