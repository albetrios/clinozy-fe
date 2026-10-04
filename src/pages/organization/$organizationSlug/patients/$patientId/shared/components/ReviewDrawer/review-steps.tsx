import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { REVIEW_SOURCE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
import { FEEDBACK_LIMITS } from '@/shared/api/clinic/feedback-contracts.ts';
import { UPLOAD_MAX_BYTES } from '@/shared/api/uploads-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { REVIEW_SOURCE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerFilesField,
  DrawerInfo,
  DrawerInput,
  DrawerStepBody,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { formatFileSize } from '@/shared/components/UploadTray/format-file-size.ts';
import { UPLOAD_TRAY_NS } from '@/shared/components/UploadTray/upload-tray.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { ratingTone } from '../../patient-feedback.ts';
import {
  REVIEW_FILE_TYPES,
  REVIEW_KEYS,
  REVIEW_NS,
  REVIEW_TEST_ID,
} from './review.constants.ts';
import { ratingLabel, type ReviewFormValues, takesReviewFile } from './review-form.ts';

const K = REVIEW_KEYS;

/** The rating chips, five stars down to one (H:4398). */
const RATINGS: readonly string[] = ['5', '4', '3', '2', '1'];

/** What a step's fields render from. */
interface ReviewStepFieldsProps {
  form: UseFormReturn<ReviewFormValues>;
  values: ReviewFormValues;
}

/**
 * Step 1 "Review" (H:4398; `patient-file.md:193–194`): Where — Google butter
 * (the default) · Video lav · Instagram blush · Feedback form sky · WhatsApp
 * sage — and the Rating, five stars down to one.
 */
export function ReviewWhereFields({ form, values }: ReviewStepFieldsProps) {
  const { t } = useTranslation([REVIEW_NS, CLINIC_NS]);
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.where)} span="full">
          <DrawerChips
            label={t(K.where)}
            options={REVIEW_SOURCE_VALUES.map((source) => ({
              value: source,
              label: t(CLINIC_KEYS.reviewSources[source], { ns: CLINIC_NS }),
              tone: REVIEW_SOURCE_TONES[source],
            }))}
            value={values.source}
            onChange={(source) => {
              if (source) form.setValue('source', source, { shouldDirty: true });
            }}
            testId={`${REVIEW_TEST_ID}-where`}
          />
        </DrawerField>
        <DrawerField label={t(K.rating)} span="full">
          <DrawerChips
            label={t(K.rating)}
            options={RATINGS.map((rating) => ({
              value: rating,
              label: ratingLabel(Number(rating)),
              tone: ratingTone(Number(rating)),
            }))}
            value={values.rating === null ? null : String(values.rating)}
            onChange={(rating) => {
              if (rating) form.setValue('rating', Number(rating), { shouldDirty: true });
            }}
            testId={`${REVIEW_TEST_ID}-rating`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** Step 2 "Details" (`patient-file.md:195`): the Link — "https://", ≤200 characters. */
export function ReviewLinkFields({ form }: Pick<ReviewStepFieldsProps, 'form'>) {
  const { t } = useTranslation(REVIEW_NS);
  const ids = useId();
  const field = useDrawerFieldIds(form, ids);
  const link = field('link');
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField
          label={t(K.link)}
          htmlFor={link.id}
          hint={t(K.linkHint)}
          error={link.error}
          span="full"
        >
          <DrawerInput
            {...link.control}
            {...form.register('link')}
            type="url"
            maxLength={FEEDBACK_LIMITS.link}
            placeholder={t(K.linkPlaceholder)}
            data-testid={`${REVIEW_TEST_ID}-link`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 3 "Notes" (`patient-file.md:196–197`): Video or screenshot — MP4, MOV,
 * JPG or PNG, through the upload tray (its 10 MB cap, not the drawn 100 MB,
 * AMBER A-F13) — the files a saved review already has, and What they said.
 */
export function ReviewNotesFields({
  form,
  values,
  attached,
}: ReviewStepFieldsProps & { attached: readonly string[] }) {
  const { t } = useTranslation(REVIEW_NS);
  const { t: tTray } = useTranslation(UPLOAD_TRAY_NS);
  const { formatNumber } = useLocaleFormat();
  const ids = useId();
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.files)} htmlFor={`${ids}-files`} span="full">
          <DrawerFilesField
            id={`${ids}-files`}
            files={values.files}
            onChange={(files) =>
              form.setValue('files', files.slice(0, FEEDBACK_LIMITS.files), {
                shouldDirty: true,
              })
            }
            accept={REVIEW_FILE_TYPES.join(',')}
            takes={takesReviewFile}
            title={t(K.filesDrop)}
            hint={t(K.filesHint, {
              limit: formatFileSize(UPLOAD_MAX_BYTES['organization-file'], {
                t: tTray,
                formatNumber,
              }),
            })}
            removeLabel={(name) => t(K.removeFile, { name })}
            testId={`${REVIEW_TEST_ID}-files`}
          />
        </DrawerField>
        {attached.length > 0 ? (
          <DrawerField label={t(K.attached)} span="full">
            <DrawerInfo wrap testId={`${REVIEW_TEST_ID}-attached`}>
              {attached.map((file) => file.split('/').pop() ?? file).join(', ')}
            </DrawerInfo>
          </DrawerField>
        ) : null}
        <DrawerField label={t(K.text)} htmlFor={`${ids}-text`} span="full">
          <DrawerTextarea
            id={`${ids}-text`}
            rows={3}
            maxLength={FEEDBACK_LIMITS.reviewText}
            placeholder={t(K.textPlaceholder)}
            data-testid={`${REVIEW_TEST_ID}-text`}
            {...form.register('text')}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
