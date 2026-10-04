import { useQueryClient } from '@tanstack/react-query';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Review } from '@/shared/api/clinic/clinic-schema.ts';
import { attachReviewFile, feedbackQueryKeys } from '@/shared/api/clinic/feedback-api.ts';
import type { ReviewSaved } from '@/shared/api/clinic/feedback-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateReview, useUpdateReview } from '@/shared/hooks/useFeedback/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';

import { REVIEW_KEYS, REVIEW_NS } from './review.constants.ts';
import {
  isReviewLink,
  type ReviewFormValues,
  reviewInputOf,
  type ReviewPlace,
} from './review-form.ts';

/** The drawer's steps, as the save opens them. */
export type ReviewStepId = 'review' | 'details' | 'notes';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<ReviewFormValues>, ReviewStepId][] = [
  ['source', 'review'],
  ['rating', 'review'],
  ['link', 'details'],
  ['files', 'notes'],
  ['text', 'notes'],
];

/** Options of {@link useReviewSave}. */
export interface UseReviewSaveOptions {
  form: UseFormReturn<ReviewFormValues>;
  /** The review a card's Edit opens; null for a new one. */
  review: Review | null;
  place: ReviewPlace;
  onStep: (step: ReviewStepId) => void;
  onDone: (saved: ReviewSaved) => void;
}

/**
 * Log a review's write on the shared drawer save (KICKOFF §6.6): a link that
 * is not https → "Add an https:// link" on the Details step; else
 * `createReview` or `updateReview` (`S:1649`) — the server sets off a
 * call-back due in 4 hours for a rating of 3 or less — then each picked file
 * goes to the upload tray and is attached as the tray confirms it.
 */
export function useReviewSave({
  form,
  review,
  place,
  onStep,
  onDone,
}: UseReviewSaveOptions) {
  const { t } = useTranslation(REVIEW_NS);
  const create = useCreateReview({ notifyOnError: false });
  const update = useUpdateReview({ notifyOnError: false });
  const { enqueue } = useUploadQueue();
  const queryClient = useQueryClient();

  return useDrawerSave<ReviewFormValues, ReviewSaved>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    toastId: 'review-save-failed',
    check: (values) =>
      values.link.trim() !== '' && !isReviewLink(values.link)
        ? { fields: ['link'], message: t(REVIEW_KEYS.badLink) }
        : null,
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'review',
      ),
    write: () => {
      const input = reviewInputOf(form.getValues(), place);
      return review
        ? update.mutateAsync({ id: review.id, input })
        : create.mutateAsync(input);
    },
    onDone: (saved) => {
      const files = form.getValues('files').map((picked) => picked.file);
      if (files.length > 0) {
        enqueue(files, {
          onUploaded: async (key) => {
            await attachReviewFile(saved.review.id, key);
            void queryClient.invalidateQueries({ queryKey: feedbackQueryKeys.all });
          },
        });
      }
      onDone(saved);
    },
  });
}
