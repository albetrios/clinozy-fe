import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { TreatmentCheckIn } from '@/shared/api/clinic/treatments-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerInput,
  DrawerQuickChips,
  DrawerStepBody,
  DrawerStepper,
  DrawerTextarea,
} from '@/shared/components/DrawerField/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PatientStaffPicker } from '../../../shared/components/PatientStaffPicker/index.ts';
import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import { AFTERCARE_CALLS, type TreatmentFormValues } from './treatment-form.ts';

const K = TREATMENT_KEYS;

/** A treatment the name field offers as a chip (an offering). */
export interface TreatmentNameChip {
  name: string;
  offeringId: string;
}

/**
 * Step 1 "Session" (H:4811–4812; `patient-file.md:131–134`): Treatment ("Pick
 * or type" with four offerings as chips) · Session number · Doctor ·
 * Therapist (a second tap clears).
 */
export function TreatmentSessionFields({
  form,
  values,
  names,
  readOnly,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  values: TreatmentFormValues;
  names: readonly TreatmentNameChip[];
  readOnly: boolean;
}) {
  const { t } = useTranslation(TREATMENT_NS);
  const ids = useId();
  const setStaff = (field: 'doctorId' | 'therapistId', id: string | null) =>
    form.setValue(field, id, { shouldDirty: true });
  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.name)} htmlFor={`${ids}-name`} span="half">
          <div className="flex min-w-0 flex-col gap-1.5">
            <DrawerInput
              id={`${ids}-name`}
              maxLength={120}
              placeholder={t(K.namePlaceholder)}
              data-testid="treatment-drawer-name"
              {...form.register('name', {
                onChange: () => form.setValue('offeringId', null, { shouldDirty: true }),
              })}
            />
            {names.length ? (
              <DrawerQuickChips
                label={t(K.name)}
                options={names.map((chip) => ({
                  label: chip.name,
                  value: chip.offeringId,
                }))}
                value={values.offeringId}
                onChange={(offeringId) => {
                  const chip = names.find((name) => name.offeringId === offeringId);
                  if (!chip) return;
                  form.setValue('name', chip.name, { shouldDirty: true });
                  form.setValue('offeringId', chip.offeringId, { shouldDirty: true });
                }}
                testId="treatment-drawer-name-quick"
              />
            ) : null}
          </div>
        </DrawerField>
        <DrawerField label={t(K.sessionNo)} htmlFor={`${ids}-session`} span="third">
          <DrawerStepper
            id={`${ids}-session`}
            label={t(K.sessionNo)}
            value={values.sessionNo}
            onValueChange={(sessionNo) =>
              form.setValue('sessionNo', sessionNo, { shouldDirty: true })
            }
            min={1}
            max={99}
            testId="treatment-drawer-session"
          />
        </DrawerField>
        <DrawerField
          label={t(K.doctor)}
          htmlFor={`${ids}-doctor`}
          span="half"
          stretch={false}
        >
          <PatientStaffPicker
            id={`${ids}-doctor`}
            staffRole="doctor"
            label={t(K.doctor)}
            placeholder={t(K.doctorPlaceholder)}
            value={values.doctorId}
            onChange={(doctorId) => setStaff('doctorId', doctorId)}
            disabled={readOnly}
            testId="treatment-drawer-doctor"
          />
        </DrawerField>
        <DrawerField
          label={t(K.therapist)}
          htmlFor={`${ids}-therapist`}
          span="half"
          stretch={false}
        >
          <PatientStaffPicker
            id={`${ids}-therapist`}
            staffRole="therapist"
            label={t(K.therapist)}
            placeholder={t(K.therapistPlaceholder)}
            value={values.therapistId}
            onChange={(therapistId) => setStaff('therapistId', therapistId)}
            clearable
            disabled={readOnly}
            testId="treatment-drawer-therapist"
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 3 "Aftercare" (H:4826–4827; `patient-file.md:136–138`): Remark · the
 * Aftercare call ("creates a task to ask how it feels and what they
 * followed"; Next day by default) · and on an edit, "Feedback on this
 * treatment" — each check-in's day, feel and score.
 */
export function TreatmentAftercareFields({
  form,
  values,
  checkIns,
  readOnly,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  values: TreatmentFormValues;
  /** The treatment's check-ins, newest first; undefined on a new treatment. */
  checkIns: readonly TreatmentCheckIn[] | undefined;
  readOnly: boolean;
}) {
  const { t } = useTranslation([TREATMENT_NS, CLINIC_NS]);
  const { formatDate } = useLocaleFormat();
  const ids = useId();
  const feedback = checkIns?.length
    ? checkIns
        .map((checkIn) =>
          t(K.aftercare.feedbackItem, {
            date: formatDate(
              localDateOf(checkIn.date),
              { day: 'numeric', month: 'short' },
              { civilDay: true },
            ),
            feel: t(CLINIC_KEYS.checkInFeels[checkIn.feel], { ns: CLINIC_NS }),
            score: checkIn.score,
          }),
        )
        .join('  ·  ')
    : t(K.aftercare.noCheckIn);
  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid>
        <DrawerField label={t(K.aftercare.remark)} htmlFor={`${ids}-remark`} span="full">
          <DrawerTextarea
            id={`${ids}-remark`}
            rows={3}
            maxLength={1000}
            placeholder={t(K.aftercare.remarkPlaceholder)}
            data-testid="treatment-drawer-remark"
            {...form.register('remark')}
          />
        </DrawerField>
        <DrawerField
          label={t(K.aftercare.call)}
          hint={t(K.aftercare.callHint)}
          span="full"
        >
          <DrawerChips
            label={t(K.aftercare.call)}
            options={AFTERCARE_CALLS.map(({ call, tone }) => ({
              value: call,
              label: t(K.aftercare.calls[call]),
              tone,
            }))}
            value={values.aftercareCall}
            onChange={(call) => {
              if (call) form.setValue('aftercareCall', call, { shouldDirty: true });
            }}
            testId="treatment-drawer-call"
          />
        </DrawerField>
        {checkIns ? (
          <DrawerField label={t(K.aftercare.feedback)} span="full">
            <DrawerInfo testId="treatment-drawer-feedback">{feedback}</DrawerInfo>
          </DrawerField>
        ) : null}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
