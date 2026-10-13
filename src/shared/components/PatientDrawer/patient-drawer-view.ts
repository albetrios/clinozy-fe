import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import { civilYearsBetween, localDateOf } from '@/shared/api/app/app-time.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { formatAppPhone, toAppPhone } from '@/shared/app/app-phone.ts';
import { formatAppPhoneDigits } from '@/shared/app/app-phone-field.ts';
import {
  GENDER_TONES,
  PATIENT_CONVERSION_TONES,
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
} from '@/shared/app/app-tones.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';
import { PERSON_CARD_KEYS } from '@/shared/components/PersonCard/person-card.constants.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PATIENT_DRAWER_KEYS, PATIENT_DRAWER_NS } from './patient-drawer.constants.ts';
import {
  missingPatientFields,
  patientFormName,
  type PatientFormValues,
} from './patient-form.ts';

const K = PATIENT_DRAWER_KEYS;

type FormatDate = ReturnType<typeof useLocaleFormat>['formatDate'];

/** The form's values as the screen words them. */
interface PatientFormLabels {
  name: string;
  types: string[];
  status: string;
  gender?: string;
  birth?: string;
  conversion?: string;
  referrer?: string;
  /** "Oct 05 · 11:00". */
  followUp?: string;
  consents: string[];
  age: number | null;
}

/** What the drawer shows of the form beyond the fields: header, footer and step heads. */
export interface PatientDrawerView {
  labels: PatientFormLabels;
  /** The footer's "Priya Shah · Aesthetic · +91 98765 43210" (or "New patient"). */
  summary: string;
  /** Each type, the status, and "28 yrs". */
  badges: DrawerBadge[];
  contact: { peek: DrawerPeekItem[]; missing: string[] };
  clinic: { peek: DrawerPeekItem[] };
}

function formatFollowUp(values: PatientFormValues, formatDate: FormatDate) {
  if (!values.followUpDate) return undefined;
  const day = formatDate(
    localDateOf(values.followUpDate),
    { month: 'short', day: '2-digit' },
    { civilDay: true },
  );
  return values.followUpTime ? `${day} · ${values.followUpTime}` : day;
}

function patientFormLabels(
  values: PatientFormValues,
  today: string,
  t: TFunction,
  formatDate: FormatDate,
): PatientFormLabels {
  const { gender, dateOfBirth, conversion, referralSource } = values;
  return {
    name: patientFormName(values),
    types: values.types.map((type) => t(APP_KEYS.patients.types[type])),
    status: t(APP_KEYS.patients.statuses[values.status]),
    gender: gender ? t(PERSON_CARD_KEYS.gender[gender]) : undefined,
    birth: dateOfBirth
      ? formatDate(
          localDateOf(dateOfBirth),
          { day: 'numeric', month: 'short', year: 'numeric' },
          { civilDay: true },
        )
      : undefined,
    conversion: conversion ? t(APP_KEYS.patients.conversions[conversion]) : undefined,
    referrer: referralSource
      ? t(APP_KEYS.patients.referralSources[referralSource])
      : undefined,
    followUp: formatFollowUp(values, formatDate),
    consents: values.consents.map((consent) => t(PERSON_CARD_KEYS.consent[consent])),
    age: dateOfBirth ? civilYearsBetween(dateOfBirth, today) : null,
  };
}

function contactPeekOf(
  values: PatientFormValues,
  labels: PatientFormLabels,
  branch: { shown: boolean; picked: BranchOption | undefined },
  t: TFunction,
): DrawerPeekItem[] {
  const digits = (value: string) => (value ? formatAppPhoneDigits(value) : undefined);
  return [
    { kind: 'value', label: t(K.fields.firstName), value: values.firstName.trim() },
    { kind: 'value', label: t(K.fields.lastName), value: values.lastName.trim() },
    { kind: 'value', label: t(K.fields.mobile), value: digits(values.phone) },
    { kind: 'value', label: t(K.fields.phone2), value: digits(values.phone2) },
    { kind: 'value', label: t(K.fields.address), value: values.address.trim() },
    ...(branch.shown
      ? [
          {
            kind: 'value' as const,
            label: t(K.fields.homeBranch),
            value: branch.picked?.name,
            tone: branch.picked?.tone,
          },
        ]
      : []),
    {
      kind: 'value',
      label: t(K.fields.gender),
      value: labels.gender,
      tone: values.gender ? GENDER_TONES[values.gender] : undefined,
    },
    { kind: 'value', label: t(K.fields.birthDate), value: labels.birth },
  ];
}

function clinicPeekOf(
  values: PatientFormValues,
  labels: PatientFormLabels,
  t: TFunction,
): DrawerPeekItem[] {
  return [
    {
      kind: 'multi',
      label: t(K.fields.types),
      values: values.types.map((type, index) => ({
        label: labels.types[index] ?? type,
        tone: PATIENT_TYPE_TONES[type],
      })),
    },
    {
      kind: 'value',
      label: t(K.fields.status),
      value: labels.status,
      tone: PATIENT_STATUS_TONES[values.status],
    },
    {
      kind: 'value',
      label: t(K.fields.conversion),
      value: labels.conversion,
      tone: values.conversion ? PATIENT_CONVERSION_TONES[values.conversion] : undefined,
    },
    { kind: 'value', label: t(K.fields.referredBy), value: values.referredByName.trim() },
    { kind: 'value', label: t(K.fields.referrerType), value: labels.referrer },
    { kind: 'value', label: t(K.fields.followUp), value: labels.followUp },
    { kind: 'value', label: t(K.fields.notes), value: values.notes.trim() },
    {
      kind: 'multi',
      label: t(K.fields.consent),
      values: labels.consents.map((label) => ({ label })),
    },
  ];
}

function drawerBadges(
  values: PatientFormValues,
  labels: PatientFormLabels,
  t: TFunction,
): DrawerBadge[] {
  return [
    ...values.types.map((type, index) => ({
      id: `type-${type}`,
      label: labels.types[index] ?? type,
      tone: PATIENT_TYPE_TONES[type],
    })),
    { id: 'status', label: labels.status, tone: PATIENT_STATUS_TONES[values.status] },
    ...(labels.age === null
      ? []
      : [{ id: 'age', label: t(PERSON_CARD_KEYS.age, { age: labels.age }) }]),
  ];
}

/**
 * What the drawer shows of its form outside the fields (`patients.md:91–103`,
 * H:3832–3852): the badge strip, the footer summary, and each step's peek
 * grid and missing fields.
 */
export function usePatientDrawerView({
  values,
  today,
  branches,
  homeBranchId,
}: {
  values: PatientFormValues;
  today: string;
  branches: readonly BranchOption[];
  homeBranchId: string | null;
}): PatientDrawerView {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const labels = patientFormLabels(values, today, t, formatDate);
  const storedPhone = toAppPhone(values.phone);

  return {
    labels,
    // The footer's "<name> · <types> · <mobile>", each part isolated.
    summary: isolateJoin([
      labels.name || t(K.summaryEmpty),
      labels.types.join(', '),
      storedPhone ? formatAppPhone(storedPhone) : '',
    ]),
    badges: drawerBadges(values, labels, t),
    contact: {
      peek: contactPeekOf(
        values,
        labels,
        {
          shown: branches.length > 1,
          picked: branches.find((branch) => branch.id === homeBranchId),
        },
        t,
      ),
      missing: missingPatientFields(values).map((field) =>
        field === 'firstName' ? t(K.fields.firstName) : t(K.fields.mobile),
      ),
    },
    clinic: { peek: clinicPeekOf(values, labels, t) },
  };
}
