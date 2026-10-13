import type { ReactNode } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  GENDER_VALUES,
  PATIENT_CONVERSION_VALUES,
  PATIENT_STATUS_VALUES,
  PATIENT_TYPE_VALUES,
  REFERRAL_SOURCE_VALUES,
  type Tone,
} from '@/shared/api/app/app-schema.ts';
import { civilYearsBetween } from '@/shared/api/app/app-time.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import {
  PATIENT_CONSENT_VALUES,
  type PatientConsent,
} from '@/shared/api/app/patients-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  GENDER_TONES,
  PATIENT_CONVERSION_TONES,
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
} from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerPhoneInput,
  DrawerQuickChips,
  DrawerStepBody,
  DrawerTextarea,
  type PickedFile,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { CalendarPicker } from '@/shared/components/Picker/CalendarPicker/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';

import { PATIENT_DRAWER_KEYS, PATIENT_DRAWER_NS } from './patient-drawer.constants.ts';
import {
  FOLLOW_UP_HOUR,
  followUpPresets,
  PATIENT_FORM_LIMITS,
  type PatientFormValues,
} from './patient-form.ts';
import { PatientPhotosField } from './PatientDrawerParts.tsx';

/** Consent chips: what was signed (`patients.md:83`) — Data and Photos sage, Marketing stone. */
const CONSENT_TONES: Readonly<Record<PatientConsent, Tone>> = {
  data: 'sage',
  photos: 'sage',
  marketing: 'stone',
};

const K = PATIENT_DRAWER_KEYS.fields;

/** What both steps' fields read: the form and its live values, the ids' prefix, view-only. */
interface PatientFieldsProps {
  form: UseFormReturn<PatientFormValues>;
  /** The form's values as they stand (`useWatch`), for what the fields derive. */
  values: PatientFormValues;
  /** Unique per drawer: the controls' DOM ids derive from it. */
  idPrefix: string;
  /** The drawer's root test id: the controls' test ids derive from it (`patient-drawer-mobile`). */
  testId: string;
  readOnly: boolean;
}

/**
 * Step 1, "Contact & personal" (KICKOFF §6.5): Contact — First name*, Last
 * name, Mobile* with the duplicate notice, Secondary mobile, Address, Home
 * branch (only with more than one open branch); Personal — Gender, Birth date.
 */
export function PatientContactFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  quick,
  branches,
  homeBranchId,
  today,
  duplicate,
  onMobileBlur,
}: PatientFieldsProps & {
  /** Quick-add: the mobile's hint is "10 digits", not "primary · WhatsApp". */
  quick: boolean;
  /** The open branches; the Home branch field shows only with more than one. */
  branches: readonly BranchOption[];
  /** The branch the chips show picked: the form's, else the default. */
  homeBranchId: string | null;
  today: string;
  /** The duplicate-mobile notice, under the Mobile field. */
  duplicate: ReactNode;
  onMobileBlur: () => void;
}) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const { t: tCard } = useTranslation(PERSON_CARD_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const { dateOfBirth } = values;
  const first = field('firstName');
  const last = field('lastName');
  const mobile = field('phone');
  const second = field('phone2');
  const address = field('address');
  const birth = field('dateOfBirth');

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid title={t(PATIENT_DRAWER_KEYS.groups.contact)}>
        <DrawerField
          span="half"
          label={t(K.firstName)}
          htmlFor={first.id}
          required
          error={first.error}
        >
          <DrawerInput
            {...first.control}
            {...form.register('firstName')}
            aria-required="true"
            maxLength={PATIENT_FORM_LIMITS.name}
            placeholder={t(K.firstName)}
            autoComplete="off"
            data-testid={`${testId}-first-name`}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.lastName)}
          htmlFor={last.id}
          error={last.error}
        >
          <DrawerInput
            {...last.control}
            {...form.register('lastName')}
            maxLength={PATIENT_FORM_LIMITS.name}
            placeholder={t(K.lastName)}
            autoComplete="off"
            data-testid={`${testId}-last-name`}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.mobile)}
          htmlFor={mobile.id}
          required
          hint={quick ? t(K.phone2Hint) : t(K.mobileHint)}
          error={mobile.error}
        >
          <Controller
            control={form.control}
            name="phone"
            render={({ field: control }) => (
              <DrawerPhoneInput
                {...mobile.control}
                aria-required="true"
                value={control.value}
                onChange={control.onChange}
                onBlur={() => {
                  control.onBlur();
                  onMobileBlur();
                }}
                data-testid={`${testId}-mobile`}
              />
            )}
          />
          {duplicate}
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.phone2)}
          htmlFor={second.id}
          hint={t(K.phone2Hint)}
          error={second.error}
        >
          <Controller
            control={form.control}
            name="phone2"
            render={({ field: control }) => (
              <DrawerPhoneInput
                {...second.control}
                value={control.value}
                onChange={control.onChange}
                onBlur={control.onBlur}
                data-testid={`${testId}-phone2`}
              />
            )}
          />
        </DrawerField>
        <DrawerField label={t(K.address)} htmlFor={address.id} error={address.error}>
          <DrawerTextarea
            {...address.control}
            {...form.register('address')}
            rows={2}
            maxLength={PATIENT_FORM_LIMITS.address}
            placeholder={t(K.addressPlaceholder)}
            data-testid={`${testId}-address`}
          />
        </DrawerField>
        {branches.length > 1 ? (
          <DrawerField label={t(K.homeBranch)}>
            <DrawerChips
              label={t(K.homeBranch)}
              options={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
                tone: branch.tone,
              }))}
              value={homeBranchId}
              onChange={(id) => form.setValue('homeBranchId', id, { shouldDirty: true })}
              testId={`${testId}-home-branch`}
            />
          </DrawerField>
        ) : null}
      </DrawerFieldGrid>

      <DrawerFieldGrid title={t(PATIENT_DRAWER_KEYS.groups.personal)}>
        <DrawerField span="half" label={t(K.gender)}>
          <Controller
            control={form.control}
            name="gender"
            render={({ field: control }) => (
              <DrawerChips
                label={t(K.gender)}
                options={GENDER_VALUES.map((gender) => ({
                  value: gender,
                  label: tCard(PERSON_CARD_KEYS.gender[gender]),
                  tone: GENDER_TONES[gender],
                }))}
                value={control.value}
                onChange={control.onChange}
                testId={`${testId}-gender`}
              />
            )}
          />
        </DrawerField>
        <DrawerField
          span="third"
          label={t(K.birthDate)}
          htmlFor={birth.id}
          hint={
            dateOfBirth
              ? t(K.age, { age: civilYearsBetween(dateOfBirth, today) })
              : undefined
          }
          error={birth.error}
        >
          <Controller
            control={form.control}
            name="dateOfBirth"
            render={({ field: control }) => (
              <CalendarPicker
                {...birth.control}
                value={control.value}
                onChange={control.onChange}
                label={t(K.birthDate)}
                max={today}
                today={today}
                testId={`${testId}-birth-date`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** The Follow-up field: the date and time pickers, then the quick chips computed from today. */
function FollowUpField({
  form,
  values,
  idPrefix,
  testId,
  today,
}: Omit<PatientFieldsProps, 'readOnly'> & { today: string }) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const followUp = field('followUpDate');
  const { followUpDate: date, followUpTime: time } = values;
  const presets = followUpPresets(today);

  const pick = (nextDate: string | null, nextTime: string | null) => {
    form.setValue('followUpDate', nextDate, { shouldDirty: true });
    form.setValue('followUpTime', nextTime, { shouldDirty: true });
    form.clearErrors('followUpDate');
  };

  return (
    <DrawerField label={t(K.followUp)} htmlFor={followUp.id} error={followUp.error}>
      <div className="flex min-w-0 gap-2">
        <DatePicker
          {...followUp.control}
          value={date}
          // A day without a time takes 11:00, shown in the time picker.
          onChange={(next) => pick(next, next ? (time ?? FOLLOW_UP_HOUR) : null)}
          label={t(K.followUpDate)}
          today={today}
          clearable
          size="md"
          className="min-w-0 flex-1"
          testId={`${testId}-follow-up-date`}
        />
        <TimePicker
          value={time}
          onChange={(next) => pick(date ?? today, next)}
          label={t(K.followUpTime)}
          // "Pick a time" with its two glyphs needs ≈138px; the date takes the rest.
          className="w-36 shrink-0"
          testId={`${testId}-follow-up-time`}
        />
      </div>
      <DrawerQuickChips
        label={t(K.followUp)}
        options={presets.map((preset) => ({
          value: preset.id,
          label: t(PATIENT_DRAWER_KEYS.followUpQuick[preset.id], { time: preset.time }),
        }))}
        value={
          presets.find((preset) => preset.date === date && preset.time === time)?.id ??
          null
        }
        onChange={(id) => {
          const preset = presets.find((candidate) => candidate.id === id);
          if (preset) pick(preset.date, preset.time);
        }}
        testId={`${testId}-follow-up`}
      />
    </DrawerField>
  );
}

/**
 * Step 2, "Clinic, referral & follow-up" (KICKOFF §6.5): Clinic — Patient
 * type, Status, Conversion; Referral & follow-up — Referred by, Referrer type,
 * Follow-up, Notes, then Consent and First photos (Q-P2).
 */
export function PatientClinicFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  today,
  photos,
  onPhotosChange,
}: PatientFieldsProps & {
  today: string;
  photos: readonly PickedFile[];
  onPhotosChange: (files: PickedFile[]) => void;
}) {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const { t: tCard } = useTranslation(PERSON_CARD_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const referred = field('referredByName');
  const notes = field('notes');
  const photosId = `${idPrefix}-photos`;

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid title={t(PATIENT_DRAWER_KEYS.groups.clinic)}>
        <DrawerField label={t(K.types)} hint={t(K.typesHint)}>
          <Controller
            control={form.control}
            name="types"
            render={({ field: control }) => (
              <DrawerChips
                multiple
                label={t(K.types)}
                options={PATIENT_TYPE_VALUES.map((type) => ({
                  value: type,
                  label: tApp(APP_KEYS.patients.types[type]),
                  tone: PATIENT_TYPE_TONES[type],
                }))}
                value={control.value}
                onChange={control.onChange}
                testId={`${testId}-types`}
              />
            )}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.status)}>
          <Controller
            control={form.control}
            name="status"
            render={({ field: control }) => (
              <DrawerChips
                label={t(K.status)}
                options={PATIENT_STATUS_VALUES.map((status) => ({
                  value: status,
                  label: tApp(APP_KEYS.patients.statuses[status]),
                  tone: PATIENT_STATUS_TONES[status],
                }))}
                value={control.value}
                onChange={(next) => {
                  if (next) control.onChange(next);
                }}
                testId={`${testId}-status`}
              />
            )}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.conversion)}>
          <Controller
            control={form.control}
            name="conversion"
            render={({ field: control }) => (
              <DrawerChips
                clearable
                label={t(K.conversion)}
                options={PATIENT_CONVERSION_VALUES.map((conversion) => ({
                  value: conversion,
                  label: tApp(APP_KEYS.patients.conversions[conversion]),
                  tone: PATIENT_CONVERSION_TONES[conversion],
                }))}
                value={control.value}
                onChange={control.onChange}
                testId={`${testId}-conversion`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>

      <DrawerFieldGrid title={t(PATIENT_DRAWER_KEYS.groups.referral)}>
        <DrawerField label={t(K.referredBy)} htmlFor={referred.id} error={referred.error}>
          <DrawerInput
            {...referred.control}
            {...form.register('referredByName')}
            maxLength={PATIENT_FORM_LIMITS.referredBy}
            placeholder={t(K.referredByPlaceholder)}
            autoComplete="off"
            data-testid={`${testId}-referred-by`}
          />
        </DrawerField>
        <DrawerField label={t(K.referrerType)}>
          <Controller
            control={form.control}
            name="referralSource"
            render={({ field: control }) => (
              <DrawerChips
                clearable
                label={t(K.referrerType)}
                options={REFERRAL_SOURCE_VALUES.map((source) => ({
                  value: source,
                  label: tApp(APP_KEYS.patients.referralSources[source]),
                }))}
                value={control.value}
                onChange={control.onChange}
                testId={`${testId}-referrer-type`}
              />
            )}
          />
        </DrawerField>
        <FollowUpField
          form={form}
          values={values}
          idPrefix={idPrefix}
          testId={testId}
          today={today}
        />
        <DrawerField label={t(K.notes)} htmlFor={notes.id} error={notes.error}>
          <DrawerTextarea
            {...notes.control}
            {...form.register('notes')}
            rows={3}
            maxLength={PATIENT_FORM_LIMITS.notes}
            placeholder={t(K.notesPlaceholder)}
            data-testid={`${testId}-notes`}
          />
        </DrawerField>
        <DrawerField label={t(K.consent)} hint={t(K.consentHint)}>
          <Controller
            control={form.control}
            name="consents"
            render={({ field: control }) => (
              <DrawerChips
                multiple
                label={t(K.consent)}
                options={PATIENT_CONSENT_VALUES.map((consent) => ({
                  value: consent,
                  label: tCard(PERSON_CARD_KEYS.consent[consent]),
                  tone: CONSENT_TONES[consent],
                }))}
                value={control.value}
                onChange={control.onChange}
                testId={`${testId}-consent`}
              />
            )}
          />
        </DrawerField>
        <DrawerField label={t(K.photos)} htmlFor={photosId} hint={t(K.photosHint)}>
          <PatientPhotosField
            id={photosId}
            files={photos}
            onChange={onPhotosChange}
            disabled={readOnly}
            testId={testId}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
