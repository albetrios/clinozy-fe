import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';

/** The review codes (clinozy-be D83 (4)) — their own, so Marketing logs reviews. */
const REVIEW_CODES = {
  log: 'patient_review:create',
  edit: 'patient_review:update',
  remove: 'patient_review:delete',
} as const;

/** What the member may do with a patient's reviews — every flag `false` until access resolves. */
export interface ReviewAccess {
  /** The access answered: before, a `false` means "not known yet", never "not allowed". */
  resolved: boolean;
  /** Log a review (`patient_review:create`). */
  log: boolean;
  /** Edit a review and log what was done about it (`patient_review:update`). */
  edit: boolean;
  /** Remove and restore a review (`patient_review:delete`). */
  remove: boolean;
}

/**
 * The review gates: the review codes in force (a View-as preview's too) — reviews left
 * `patient:update` for codes of their own (clinozy-be D83 (4)), so Marketing logs the reviews
 * patients give without changing the file.
 */
export function useReviewAccess(): ReviewAccess {
  const access = useAppAccess();
  const can = (code: string) => access.isResolved && access.canCode(code);
  return {
    resolved: access.isResolved,
    log: can(REVIEW_CODES.log),
    edit: can(REVIEW_CODES.edit),
    remove: can(REVIEW_CODES.remove),
  };
}
