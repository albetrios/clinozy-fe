import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  CHECKIN_FEEL_VALUES,
  CHECKIN_FOLLOWED_VALUES,
} from '@/shared/api/app/app-schema.ts';
import {
  type CheckInOffering,
  FEEDBACK_LIMITS,
  type PatientCheckIn,
} from '@/shared/api/app/feedback-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { CHECKIN_FEEL_TONES, CHECKIN_FOLLOWED_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerStepBody,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';

import { followedLabel, scoreTone } from '../../patient-feedback.ts';
import { CHECK_IN_KEYS, CHECK_IN_NS, CHECK_IN_TEST_ID } from './check-in.constants.ts';
import type { CheckInFormValues } from './check-in-form.ts';

const K = CHECK_IN_KEYS;

/** The score chips, 1 to 10 (H:4396). */
const SCORES = Array.from({ length: 10 }, (_, index) => String(index + 1));

/**
 * What a step's fields render from. Each field shows its own error — the save's ask or the
 * server's (`useDrawerSave` puts the API's `errors[].field` on it).
 */
interface CheckInStepFieldsProps {
  form: UseFormReturn<CheckInFormValues>;
  values: CheckInFormValues;
  /** The patient's check-in before this one — the "Last time: …" placeholders. */
  previous: PatientCheckIn | null;
}

/**
 * Step 1 "How is it now" (H:4396; `patient-file.md:175–177`): Compared with
 * last visit — Much better sage · Better mint · Same stone · Worse blush — and
 * the patient's own score 1–10 (1–4 blush, 5–7 butter, 8–10 sage), both of
 * which the save asks for (a score is required, Q18), and In their words, its
 * placeholder the last check-in's words when there are some.
 */
export function CheckInNowFields({ form, values, previous }: CheckInStepFieldsProps) {
  const { t } = useTranslation([CHECK_IN_NS, APP_NS]);
  const field = useDrawerFieldIds(form, useId());
  const words = field('currentState');
  const lastWords = previous?.currentState?.trim();
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        {/* Asked for by the save's toast, not marked (H:4396 draws no "*"). */}
        <DrawerField label={t(K.feel)} error={field('feel').error} span="full">
          <DrawerChips
            label={t(K.feel)}
            options={CHECKIN_FEEL_VALUES.map((feel) => ({
              value: feel,
              label: t(APP_KEYS.checkInFeels[feel], { ns: APP_NS }),
              tone: CHECKIN_FEEL_TONES[feel],
            }))}
            value={values.feel}
            onChange={(feel) => {
              if (feel) form.setValue('feel', feel, { shouldDirty: true });
            }}
            testId={`${CHECK_IN_TEST_ID}-feel`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.score)}
          hint={t(K.scoreHint)}
          error={field('score').error}
          span="full"
        >
          <DrawerChips
            label={t(K.score)}
            options={SCORES.map((score) => ({
              value: score,
              label: score,
              tone: scoreTone(Number(score)),
            }))}
            value={values.score > 0 ? String(values.score) : null}
            onChange={(score) => {
              if (score) form.setValue('score', Number(score), { shouldDirty: true });
            }}
            testId={`${CHECK_IN_TEST_ID}-score`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.words)}
          htmlFor={words.id}
          error={words.error}
          span="full"
        >
          <DrawerTextarea
            {...words.control}
            rows={3}
            maxLength={FEEDBACK_LIMITS.now}
            placeholder={
              lastWords ? t(K.wordsLast, { text: lastWords }) : t(K.wordsPlaceholder)
            }
            data-testid={`${CHECK_IN_TEST_ID}-now`}
            {...form.register('currentState')}
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
  const field = useDrawerFieldIds(form, useId());
  const details = field('followedNote');
  const advised = previous?.nextPlan?.trim();
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.followed)} error={field('followed').error} span="full">
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
        <DrawerField
          label={t(K.details)}
          htmlFor={details.id}
          error={details.error}
          span="full"
        >
          <DrawerTextarea
            {...details.control}
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
 * when a new check-in saves (TR10). An edit names the ones it planned, read
 * only: the API changes the plan in the plan, not on the check-in.
 */
export function CheckInNextFields({
  form,
  values,
  options,
  editing,
}: Omit<CheckInStepFieldsProps, 'previous'> & {
  options: readonly PickerOption<CheckInOffering>[];
  /** A saved check-in: its offerings show, not pick. */
  editing: boolean;
}) {
  const { t } = useTranslation(CHECK_IN_NS);
  const field = useDrawerFieldIds(form, useId());
  const plan = field('nextPlan');
  const offerings = field('nextOfferingIds');
  return (
    <DrawerStepBody readOnly={false}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.plan)} htmlFor={plan.id} error={plan.error} span="full">
          <DrawerTextarea
            {...plan.control}
            rows={3}
            maxLength={FEEDBACK_LIMITS.nextPlan}
            placeholder={t(K.planPlaceholder)}
            data-testid={`${CHECK_IN_TEST_ID}-plan`}
            {...form.register('nextPlan')}
          />
        </DrawerField>
        {editing ? (
          <PlannedOfferings values={values} options={options} />
        ) : (
          <DrawerField
            label={t(K.offerings)}
            htmlFor={offerings.id}
            hint={t(K.offeringsHint)}
            error={offerings.error}
            span="full"
          >
            <Picker
              multiple
              id={offerings.id}
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
        )}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** An edit's planned offerings by name — nothing when it planned none. */
function PlannedOfferings({
  values,
  options,
}: {
  values: CheckInFormValues;
  options: readonly PickerOption<CheckInOffering>[];
}) {
  const { t } = useTranslation(CHECK_IN_NS);
  const names = values.nextOfferingIds
    .map((id) => options.find((option) => option.key === id)?.label)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return null;
  return (
    <DrawerField label={t(K.offeringsPlanned)} span="full">
      <DrawerInfo wrap testId={`${CHECK_IN_TEST_ID}-offerings-planned`}>
        {names.join(', ')}
      </DrawerInfo>
    </DrawerField>
  );
}
