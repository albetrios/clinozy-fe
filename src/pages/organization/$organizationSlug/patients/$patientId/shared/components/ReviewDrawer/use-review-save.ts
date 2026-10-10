import { useQueryClient } from '@tanstack/react-query';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { attachReviewFile, feedbackQueryKeys } from '@/shared/api/clinic/feedback-api.ts';
import type { PatientReview } from '@/shared/api/clinic/feedback-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateReview, useUpdateReview } from '@/shared/hooks/useFeedback/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';

import { REVIEW_KEYS, REVIEW_NS } from './review.constants.ts';
import { isReviewLink, reviewFieldsOf, type ReviewFormValues } from './review-form.ts';

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

/** The API's names the form spells differently: a review's `file_keys` are the picked files. */
const SERVER_FIELDS: Readonly<Record<string, FieldPath<ReviewFormValues>>> = {
  fileKeys: 'files',
};

/** Where a new review sits: the patient, the visit it follows, its day. */
interface ReviewPlace {
  patientId: string;
  appointmentId: string | null;
  date: string;
}

/** Options of {@link useReviewSave}. */
export interface UseReviewSaveOptions {
  form: UseFormReturn<ReviewFormValues>;
  /** The review a card's Edit opens, as last read; null for a new one. */
  review: PatientReview | null;
  place: ReviewPlace;
  onStep: (step: ReviewStepId) => void;
  /** Someone saved it since the drawer read it (`409 record_changed`): read it again. */
  onStale?: () => void;
  onDone: (saved: PatientReview) => void;
}

/**
 * Log a review's write on the shared drawer save (KICKOFF §6.6): a link that
 * is not https → "Add an https:// link" on the Details step; else `POST …/reviews`
 * or a stale-checked `PATCH` — the server opens the call-back for a rating of 3
 * or less — then each picked file goes to the upload tray and is filed on the
 * review (`file_keys`) as the tray confirms it.
 */
export function useReviewSave({
  form,
  review,
  place,
  onStep,
  onStale,
  onDone,
}: UseReviewSaveOptions) {
  const { t } = useTranslation(REVIEW_NS);
  const create = useCreateReview({ notifyOnError: false });
  const update = useUpdateReview({ notifyOnError: false });
  const { enqueue } = useUploadQueue();
  const queryClient = useQueryClient();

  return useDrawerSave<ReviewFormValues, PatientReview>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    serverFields: SERVER_FIELDS,
    toastId: 'review-save-failed',
    check: (values) =>
      values.link.trim() !== '' && !isReviewLink(values.link)
        ? { fields: ['link'], message: t(REVIEW_KEYS.badLink) }
        : null,
    onStale,
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'review',
      ),
    write: () => {
      const fields = reviewFieldsOf(form.getValues());
      return review
        ? update.mutateAsync({ review, fields })
        : create.mutateAsync({
            patientId: place.patientId,
            input: { ...fields, appointmentId: place.appointmentId, date: place.date },
          });
    },
    onDone: (saved) => {
      const files = form.getValues('files').map((picked) => picked.file);
      if (files.length > 0) {
        enqueue(files, {
          onUploaded: async (fileKey) => {
            await attachReviewFile({
              patientId: saved.patientId,
              reviewId: saved.id,
              fileKey,
            });
            void queryClient.invalidateQueries({ queryKey: feedbackQueryKeys.all });
          },
        });
      }
      onDone(saved);
    },
  });
}
