import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import { civilYearsBetween, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone, toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { formatClinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';
import {
  GENDER_TONES,
  PATIENT_CONVERSION_TONES,
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  type DrawerPeekItem,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import { PERSON_CARD_KEYS } from '@/shared/components/PersonCard/person-card.constants.ts';
import type { DrawerBadge } from '@/shared/components/RecordDrawer/index.ts';
import { RECORD_DRAWER_KEYS } from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
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
  contact: { peek: DrawerPeekItem[]; summary: string; missing: string[] };
  clinic: { peek: DrawerPeekItem[]; summary: string };
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
    types: values.types.map((type) => t(CLINIC_KEYS.patients.types[type])),
    status: t(CLINIC_KEYS.patients.statuses[values.status]),
    gender: gender ? t(PERSON_CARD_KEYS.gender[gender]) : undefined,
    birth: dateOfBirth
      ? formatDate(
          localDateOf(dateOfBirth),
          { day: 'numeric', month: 'short', year: 'numeric' },
          { civilDay: true },
        )
      : undefined,
    conversion: conversion ? t(CLINIC_KEYS.patients.conversions[conversion]) : undefined,
    referrer: referralSource
      ? t(CLINIC_KEYS.patients.referralSources[referralSource])
      : undefined,
    followUp: formatFollowUp(values, formatDate),
    consents: values.consents.map((consent) => t(PERSON_CARD_KEYS.consent[consent])),
    age: dateOfBirth ? civilYearsBetween(dateOfBirth, today) : null,
  };
}

function contactPeekOf(
  values: PatientFormValues,
  labels: PatientFormLabels,
  branch: { shown: boolean; picked: Branch | undefined },
  t: TFunction,
): DrawerPeekItem[] {
  const digits = (value: string) => (value ? formatClinicPhoneDigits(value) : undefined);
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
 * grid, head summary ("Not filled yet" before anything is) and missing fields.
 */
export function usePatientDrawerView({
  values,
  today,
  branches,
  homeBranchId,
}: {
  values: PatientFormValues;
  today: string;
  branches: readonly Branch[];
  homeBranchId: string | null;
}): PatientDrawerView {
  const { t } = useTranslation(PATIENT_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const labels = patientFormLabels(values, today, t, formatDate);
  const storedPhone = toClinicPhone(values.phone);
  const notFilled = t(RECORD_DRAWER_KEYS.step.notFilled);

  const contactPeek = contactPeekOf(
    values,
    labels,
    {
      shown: branches.length > 1,
      picked: branches.find((branch) => branch.id === homeBranchId),
    },
    t,
  );
  const clinicPeek = clinicPeekOf(values, labels, t);

  return {
    labels,
    // The footer's "<name> · <types> · <mobile>", each part isolated.
    summary: isolateJoin([
      labels.name || t(K.summaryEmpty),
      labels.types.join(', '),
      storedPhone ? formatClinicPhone(storedPhone) : '',
    ]),
    badges: drawerBadges(values, labels, t),
    contact: {
      peek: contactPeek,
      summary: drawerStepSummary(
        contactPeek.map((item) => (item.kind === 'value' ? item.value : undefined)),
        notFilled,
      ),
      missing: missingPatientFields(values).map((field) =>
        field === 'firstName' ? t(K.fields.firstName) : t(K.fields.mobile),
      ),
    },
    clinic: {
      peek: clinicPeek,
      summary: drawerStepSummary(
        [
          labels.types.join(', '),
          labels.status,
          labels.conversion,
          values.referredByName.trim(),
          labels.referrer,
          labels.followUp,
          values.notes.trim(),
          labels.consents.join(', '),
        ],
        notFilled,
      ),
    },
  };
}
