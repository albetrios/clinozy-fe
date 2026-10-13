import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { REVIEW_SOURCE_VALUES } from '@/shared/api/app/app-schema.ts';
import { FEEDBACK_LIMITS } from '@/shared/api/app/feedback-contracts.ts';
import { UPLOAD_MAX_BYTES } from '@/shared/api/uploads-api.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { REVIEW_SOURCE_TONES } from '@/shared/app/app-tones.ts';
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
  const { t } = useTranslation([REVIEW_NS, APP_NS]);
  const field = useDrawerFieldIds(form, useId());
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.where)} error={field('source').error} span="full">
          <DrawerChips
            label={t(K.where)}
            options={REVIEW_SOURCE_VALUES.map((source) => ({
              value: source,
              label: t(APP_KEYS.reviewSources[source], { ns: APP_NS }),
              tone: REVIEW_SOURCE_TONES[source],
            }))}
            value={values.source}
            onChange={(source) => {
              if (source) form.setValue('source', source, { shouldDirty: true });
            }}
            testId={`${REVIEW_TEST_ID}-where`}
          />
        </DrawerField>
        <DrawerField label={t(K.rating)} error={field('rating').error} span="full">
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

/** Step 2 "Details" (`patient-file.md:195`): the Link — "https://", ≤200 characters (the API's 500). */
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
 * AMBER A-F13), ten on a review at most — how many files a saved review
 * already has (their names are not kept and none can be read back, B1), and
 * What they said.
 */
export function ReviewNotesFields({
  form,
  values,
  attached,
}: ReviewStepFieldsProps & {
  /** How many files the saved review has. */
  attached: number;
}) {
  const { t } = useTranslation(REVIEW_NS);
  const { t: tTray } = useTranslation(UPLOAD_TRAY_NS);
  const { formatNumber } = useLocaleFormat();
  const field = useDrawerFieldIds(form, useId());
  const files = field('files');
  const text = field('text');
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField
          label={t(K.files)}
          htmlFor={files.id}
          error={files.error}
          span="full"
        >
          <DrawerFilesField
            id={files.id}
            files={values.files}
            onChange={(picked) =>
              form.setValue(
                'files',
                picked.slice(0, Math.max(0, FEEDBACK_LIMITS.files - attached)),
                { shouldDirty: true },
              )
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
        {attached > 0 ? (
          <DrawerField label={t(K.attached)} span="full">
            <DrawerInfo wrap testId={`${REVIEW_TEST_ID}-attached`}>
              {t(K.attachedFiles, { count: attached })}
            </DrawerInfo>
          </DrawerField>
        ) : null}
        <DrawerField label={t(K.text)} htmlFor={text.id} error={text.error} span="full">
          <DrawerTextarea
            {...text.control}
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
