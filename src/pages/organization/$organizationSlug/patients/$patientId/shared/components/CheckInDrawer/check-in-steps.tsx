import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  type CheckIn,
  CHECKIN_FEEL_VALUES,
  CHECKIN_FOLLOWED_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import { FEEDBACK_LIMITS } from '@/shared/api/clinic/feedback-contracts.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  CHECKIN_FEEL_TONES,
  CHECKIN_FOLLOWED_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerStepBody,
  DrawerTextarea,
} from '@/shared/components/DrawerField/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';

import { followedLabel, scoreTone } from '../../patient-feedback.ts';
import { CHECK_IN_KEYS, CHECK_IN_NS, CHECK_IN_TEST_ID } from './check-in.constants.ts';
import type { CheckInFormValues } from './check-in-form.ts';

const K = CHECK_IN_KEYS;

/** The score chips, 1 to 10 (H:4396). */
const SCORES = Array.from({ length: 10 }, (_, index) => String(index + 1));

/** What a step's fields render from. */
interface CheckInStepFieldsProps {
  form: UseFormReturn<CheckInFormValues>;
  values: CheckInFormValues;
  /** The patient's check-in before this one — the "Last time: …" placeholders. */
  previous: CheckIn | null;
}

/**
 * Step 1 "How is it now" (H:4396; `patient-file.md:175–177`): Compared with
 * last visit — Much better sage · Better mint · Same stone · Worse blush, which
 * the save asks for — the patient's own score 1–10 (1–4 blush, 5–7 butter,
 * 8–10 sage; tap the picked one to clear it), and In their words, its
 * placeholder the last check-in's words when there are some.
 */
export function CheckInNowFields({ form, values, previous }: CheckInStepFieldsProps) {
  const { t } = useTranslation([CHECK_IN_NS, CLINIC_NS]);
  const ids = useId();
  const lastWords = previous?.now?.trim();
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        {/* Asked for by the save's toast, not marked (H:4396 draws no "*"). */}
        <DrawerField label={t(K.feel)} span="full">
          <DrawerChips
            label={t(K.feel)}
            options={CHECKIN_FEEL_VALUES.map((feel) => ({
              value: feel,
              label: t(CLINIC_KEYS.checkInFeels[feel], { ns: CLINIC_NS }),
              tone: CHECKIN_FEEL_TONES[feel],
            }))}
            value={values.feel}
            onChange={(feel) => {
              if (feel) form.setValue('feel', feel, { shouldDirty: true });
            }}
            testId={`${CHECK_IN_TEST_ID}-feel`}
          />
        </DrawerField>
        <DrawerField label={t(K.score)} hint={t(K.scoreHint)} span="full">
          <DrawerChips
            label={t(K.score)}
            options={SCORES.map((score) => ({
              value: score,
              label: score,
              tone: scoreTone(Number(score)),
            }))}
            value={values.score > 0 ? String(values.score) : null}
            onChange={(score) =>
              form.setValue('score', score ? Number(score) : 0, { shouldDirty: true })
            }
            clearable
            testId={`${CHECK_IN_TEST_ID}-score`}
          />
        </DrawerField>
        <DrawerField label={t(K.words)} htmlFor={`${ids}-now`} span="full">
          <DrawerTextarea
            id={`${ids}-now`}
            rows={3}
            maxLength={FEEDBACK_LIMITS.now}
            placeholder={
              lastWords ? t(K.wordsLast, { text: lastWords }) : t(K.wordsPlaceholder)
            }
            data-testid={`${CHECK_IN_TEST_ID}-now`}
            {...form.register('now')}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 2 "What they followed" (`patient-file.md:178–179`): Followed the
 * advice — Fully sage · Mostly mint · Partly butter · Not at all blush — and
 * Details, its placeholder the plan advised last time when there was one.
 */
export function CheckInFollowedFields({
  form,
  values,
  previous,
}: CheckInStepFieldsProps) {
  const { t } = useTranslation(CHECK_IN_NS);
  const ids = useId();
  const advised = previous?.nextPlan?.trim();
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.followed)} span="full">
          <DrawerChips
            label={t(K.followed)}
            options={CHECKIN_FOLLOWED_VALUES.map((followed) => ({
              value: followed,
              label: followedLabel(t, followed),
              tone: CHECKIN_FOLLOWED_TONES[followed],
            }))}
            value={values.followed}
            onChange={(followed) =>
              form.setValue('followed', followed, { shouldDirty: true })
            }
            clearable
            testId={`${CHECK_IN_TEST_ID}-followed`}
          />
        </DrawerField>
        <DrawerField label={t(K.details)} htmlFor={`${ids}-details`} span="full">
          <DrawerTextarea
            id={`${ids}-details`}
            rows={3}
            maxLength={FEEDBACK_LIMITS.followedNote}
            placeholder={
              advised ? t(K.detailsLast, { text: advised }) : t(K.detailsPlaceholder)
            }
            data-testid={`${CHECK_IN_TEST_ID}-details`}
            {...form.register('followedNote')}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 3 "Next plan of action" (`patient-file.md:180–181`): the Plan, and the
 * offerings to add to the patient's suggestions — each becomes a Planned row
 * on save.
 */
export function CheckInNextFields({
  form,
  values,
  options,
}: Omit<CheckInStepFieldsProps, 'previous'> & {
  options: readonly PickerOption<OfferingRecord>[];
}) {
  const { t } = useTranslation(CHECK_IN_NS);
  const ids = useId();
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.plan)} htmlFor={`${ids}-plan`} span="full">
          <DrawerTextarea
            id={`${ids}-plan`}
            rows={3}
            maxLength={FEEDBACK_LIMITS.nextPlan}
            placeholder={t(K.planPlaceholder)}
            data-testid={`${CHECK_IN_TEST_ID}-plan`}
            {...form.register('nextPlan')}
          />
        </DrawerField>
        <DrawerField
          label={t(K.offerings)}
          htmlFor={`${ids}-offerings`}
          hint={t(K.offeringsHint)}
          span="full"
        >
          <Picker
            multiple
            id={`${ids}-offerings`}
            label={t(K.offerings)}
            placeholder={t(K.offeringsPlaceholder)}
            searchPlaceholder={t(K.offeringsPlaceholder)}
            searchable
            options={options}
            value={values.nextOfferingIds}
            onChange={(offeringIds) =>
              form.setValue(
                'nextOfferingIds',
                offeringIds.slice(0, FEEDBACK_LIMITS.offerings),
                { shouldDirty: true },
              )
            }
            size="md"
            testId={`${CHECK_IN_TEST_ID}-offerings`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
