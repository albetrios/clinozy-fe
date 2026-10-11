import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { localDateOf } from '@/shared/api/app/app-time.ts';
import type { PatientPackageRow } from '@/shared/api/app/patient-packages-contracts.ts';
import {
  TREATMENT_LIMITS,
  type TreatmentCheckIn,
} from '@/shared/api/app/treatments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
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
import {
  AFTERCARE_CALLS,
  onPackageForm,
  type TreatmentFormValues,
} from './treatment-form.ts';

const K = TREATMENT_KEYS;

/** A treatment the name field offers as a chip (an offering). */
export interface TreatmentNameChip {
  name: string;
  offeringId: string;
}

/** The session number: the stepper, or the package's words when the server numbers it. */
function SessionNumberField({
  form,
  values,
  fixed,
  fieldId,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  values: TreatmentFormValues;
  /** An edit of a session spent from a package: its number stays (the server refuses a change). */
  fixed: boolean;
  fieldId: string;
}) {
  const { t } = useTranslation(TREATMENT_NS);
  const fromPackage = !fixed && values.packageId !== null;
  return (
    <DrawerField
      label={t(K.sessionNo)}
      htmlFor={fromPackage ? undefined : fieldId}
      hint={fixed ? t(K.package.numbered) : undefined}
      span="third"
    >
      {fromPackage ? (
        <DrawerInfo testId="treatment-drawer-session-numbered">
          {t(K.package.numbered)}
        </DrawerInfo>
      ) : (
        <DrawerStepper
          id={fieldId}
          label={t(K.sessionNo)}
          value={values.sessionNumber}
          onValueChange={(sessionNumber) =>
            form.setValue('sessionNumber', sessionNumber, { shouldDirty: true })
          }
          min={TREATMENT_LIMITS.session.min}
          max={TREATMENT_LIMITS.session.max}
          disabled={fixed}
          testId="treatment-drawer-session"
        />
      )}
    </DrawerField>
  );
}

/**
 * "From package" (§6 #20): a new session picks one of the patient's packages
 * with a session left — saving spends it and the server numbers the session;
 * an edit names the package the session spent.
 */
function PackageField({
  form,
  values,
  packages,
  linkedPackage,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  values: TreatmentFormValues;
  packages: readonly PatientPackageRow[];
  linkedPackage: PatientPackageRow | null;
}) {
  const { t } = useTranslation(TREATMENT_NS);
  if (linkedPackage) {
    return (
      <DrawerField label={t(K.package.label)} span="full">
        <DrawerInfo testId="treatment-drawer-package">
          {t(K.package.uses, { name: linkedPackage.name })}
        </DrawerInfo>
      </DrawerField>
    );
  }
  if (packages.length === 0) return null;
  return (
    <DrawerField label={t(K.package.label)} hint={t(K.package.hint)} span="full">
      <DrawerChips
        label={t(K.package.label)}
        options={packages.map((row) => ({
          value: row.id,
          label: t(K.package.option, {
            name: row.name,
            used: row.sessionsUsed,
            total: row.sessionsTotal,
          }),
          tone: 'mint' as const,
        }))}
        value={values.packageId}
        onChange={(packageId) => {
          const row = packages.find((entry) => entry.id === packageId);
          const next = row
            ? onPackageForm(form.getValues(), row)
            : { ...form.getValues(), packageId: null };
          form.setValue('name', next.name, { shouldDirty: true });
          form.setValue('offeringId', next.offeringId, { shouldDirty: true });
          form.setValue('packageId', next.packageId, { shouldDirty: true });
        }}
        clearable
        testId="treatment-drawer-package"
      />
    </DrawerField>
  );
}

/**
 * Step 1 "Session" (H:4811–4812; `patient-file.md:131–134`): Treatment ("Pick
 * or type" with four offerings as chips) · Session number · Doctor ·
 * Therapist (a second tap clears) · From package.
 */
export function TreatmentSessionFields({
  form,
  values,
  names,
  packages,
  linkedPackage,
  sessionFixed,
  readOnly,
}: {
  form: UseFormReturn<TreatmentFormValues>;
  values: TreatmentFormValues;
  names: readonly TreatmentNameChip[];
  /** The packages a new session may spend; none on an edit. */
  packages: readonly PatientPackageRow[];
  /** The package an edited session spent, when the file still lists it. */
  linkedPackage: PatientPackageRow | null;
  /** The session was spent from a package: its number stays. */
  sessionFixed: boolean;
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
              maxLength={TREATMENT_LIMITS.name}
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
                  // Another treatment is not the picked package's session.
                  const picked = packages.find((row) => row.id === values.packageId);
                  if (picked && picked.offeringId !== chip.offeringId) {
                    form.setValue('packageId', null, { shouldDirty: true });
                  }
                }}
                testId="treatment-drawer-name-quick"
              />
            ) : null}
          </div>
        </DrawerField>
        <SessionNumberField
          form={form}
          values={values}
          fixed={sessionFixed}
          fieldId={`${ids}-session`}
        />
        <DrawerField
          label={t(K.doctor)}
          htmlFor={`${ids}-doctor`}
          span="half"
          stretch={false}
        >
          <PatientStaffPicker
            id={`${ids}-doctor`}
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
            label={t(K.therapist)}
            placeholder={t(K.therapistPlaceholder)}
            value={values.therapistId}
            onChange={(therapistId) => setStaff('therapistId', therapistId)}
            clearable
            disabled={readOnly}
            testId="treatment-drawer-therapist"
          />
        </DrawerField>
        <PackageField
          form={form}
          values={values}
          packages={packages}
          linkedPackage={linkedPackage}
        />
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
  const { t } = useTranslation([TREATMENT_NS, APP_NS]);
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
            feel: t(APP_KEYS.checkInFeels[checkIn.feel], { ns: APP_NS }),
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
            maxLength={TREATMENT_LIMITS.remark}
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
