import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import type { ReviewSource } from '@/shared/api/clinic/clinic-schema.ts';
import { feedbackQueryKeys, fetchReview } from '@/shared/api/clinic/feedback-api.ts';
import type { PatientReview } from '@/shared/api/clinic/feedback-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { REVIEW_SOURCE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { ratingTone } from '../../patient-feedback.ts';
import { REVIEW_KEYS, REVIEW_NS, REVIEW_TEST_ID } from './review.constants.ts';
import {
  newReviewForm,
  ratingLabel,
  reviewFormOf,
  type ReviewFormValues,
} from './review-form.ts';
import {
  ReviewLinkFields,
  ReviewNotesFields,
  ReviewWhereFields,
} from './review-steps.tsx';
import { type ReviewStepId, useReviewSave } from './use-review-save.ts';

const K = REVIEW_KEYS;

/** Props of {@link ReviewDrawer}. */
export interface ReviewDrawerProps {
  patientId: string;
  /** The patient's full name — the sub line and the saved toast. */
  patientName: string;
  /** The review a card's Edit opens; null for a new one. */
  review: PatientReview | null;
  /** Where a new one was left (`?source=`, the picker's chip); Google by default. */
  source: ReviewSource | null;
  /** The visit a new one follows (`?appointment=`); an edit keeps its own. */
  appointmentId: string | null;
  /** Today's civil date — a new review's day. */
  today: string;
  onClose: () => void;
}

/**
 * An edit's record, kept in step with a reload: a save refused as stale (`409
 * record_changed`) reads the review again and restarts the form on what was saved.
 */
function useEditingReview(
  review: PatientReview | null,
  reset: (record: PatientReview) => void,
) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const [record, setRecord] = useState(review);
  const reload = async () => {
    if (!record) return;
    const fresh = await queryClient.fetchQuery({
      queryKey: feedbackQueryKeys.review(organizationId, record.id),
      queryFn: () => fetchReview(record.patientId, record.id),
      staleTime: 0,
    });
    setRecord(fresh);
    reset(fresh);
  };
  return { record, reload };
}

/**
 * Log a review — `reviews/create/`, `reviews/$reviewId/edit/` (KICKOFF §6.6
 * Drawers; H:4398; `patient-file.md:189–200`): 560px, "Log a review" over
 * "Dharti Galani · kept on the patient file so anyone can find it later";
 * steps "Review" (Where, Rating) → "Details" (Link) → "Notes" (Video or
 * screenshot, What they said). "Save review" → "5★ Google review saved for
 * Dharti Galani", with " · call-back task created" when the server says it
 * needs action (a rating of 3 or less — it opened the call-back); an edit →
 * "Review updated".
 */
export function ReviewDrawer({
  patientId,
  patientName,
  review,
  source,
  appointmentId,
  today,
  onClose,
}: ReviewDrawerProps) {
  const { t } = useTranslation([REVIEW_NS, CLINIC_NS]);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const form = useForm<ReviewFormValues>({
    defaultValues: review ? reviewFormOf(review) : newReviewForm(source ?? undefined),
  });
  const { record, reload } = useEditingReview(review, (fresh) =>
    form.reset(reviewFormOf(fresh)),
  );
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('review');
  const sourceLabel = (value: ReviewSource) =>
    t(CLINIC_KEYS.reviewSources[value], { ns: CLINIC_NS });

  const { saveState, save } = useReviewSave({
    form,
    review: record,
    place: { patientId, appointmentId, date: today },
    onStep: (next: ReviewStepId) => setStep(next),
    onStale: record ? () => void reload() : undefined,
    onDone: (saved) => {
      if (record) {
        notify.success(t(K.updated));
      } else {
        notify.success(
          t(K.saved, {
            rating: saved.rating ?? 0,
            source: sourceLabel(saved.source),
            name: patientName,
          }) + (saved.needsAction ? t(K.callBack) : ''),
        );
      }
      onClose();
    },
  });

  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const where = sourceLabel(values.source);
  const rating = values.rating === null ? '' : ratingLabel(values.rating);
  const link = values.link.trim();
  const text = values.text.trim();
  const files = values.files.map((picked) => picked.file.name).join(', ');
  const steps: DrawerStep[] = [
    {
      id: 'review',
      title: t(K.steps.review),
      summary: drawerStepSummary([where, rating], notFilled),
      peek: [
        {
          kind: 'value',
          label: t(K.where),
          value: where,
          tone: REVIEW_SOURCE_TONES[values.source],
        },
        {
          kind: 'value',
          label: t(K.rating),
          value: rating || t(K.notRated),
          tone: values.rating === null ? undefined : ratingTone(values.rating),
        },
      ],
      content: <ReviewWhereFields form={form} values={values} />,
    },
    {
      id: 'details',
      title: t(K.steps.details),
      summary: drawerStepSummary([link], notFilled),
      peek: [{ kind: 'value', label: t(K.link), value: link || undefined }],
      content: <ReviewLinkFields form={form} />,
    },
    {
      id: 'notes',
      title: t(K.steps.notes),
      summary: drawerStepSummary([files, text], notFilled),
      // The drop zone has no peek tile (H:3840 `peekOf` skips uploads).
      peek: [{ kind: 'value', label: t(K.text), value: text || undefined }],
      content: (
        <ReviewNotesFields
          form={form}
          values={values}
          attached={record?.fileKeys.length ?? 0}
        />
      ),
    },
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub, { name: isolateText(patientName) })}
      // 560px as drawn (H:4398): its zone and text are full rows that fit.
      content={{ fieldCount: 5 }}
      tone="butter"
      steps={steps}
      openStep={step}
      onOpenStepChange={setStep}
      saveLabel={t(record ? K.saveEdit : K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={REVIEW_TEST_ID}
    />
  );
}
