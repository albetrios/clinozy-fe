import type {
  Gender,
  PatientConversion,
  PatientStatus,
  PatientType,
  ReferralSource,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import {
  addCivilDays,
  addCivilMonths,
  appClockTime,
  appInstant,
  appToday,
} from '@/shared/api/app/app-time.ts';
import type {
  PatientConsent,
  PatientFields,
  PatientRecord,
} from '@/shared/api/app/patients-contracts.ts';
import { toAppPhone } from '@/shared/app/app-phone.ts';
import { appPhoneDigits } from '@/shared/app/app-phone-field.ts';

/**
 * The patient drawer's form (`patients.md:44–58`; KICKOFF §6.5): text as
 * typed, the mobiles as their ten digits, chips as the contract's values, the
 * follow-up as a clinic-local date and time. {@link patientInputOf} turns it
 * into the contract's fields.
 */
export interface PatientFormValues {
  firstName: string;
  lastName: string;
  /** The mobile's digits (`9876543210`). */
  phone: string;
  phone2: string;
  address: string;
  /** Picked in the Home branch chips; `null` keeps the default branch. */
  homeBranchId: string | null;
  gender: Gender | null;
  /** Whether the desk picks a birth date or types an age (`date` · `age`). */
  birthMode: PatientBirthMode;
  /** `YYYY-MM-DD` — the Birth date mode's value. */
  dateOfBirth: string | null;
  /** The Age mode's whole years, as typed (`34`); empty clears the birth. */
  age: string;
  types: PatientType[];
  status: PatientStatus;
  conversion: PatientConversion | null;
  referredByName: string;
  referralSource: ReferralSource | null;
  /** Clinic-local `YYYY-MM-DD`. */
  followUpDate: string | null;
  /** Clinic-local `HH:mm`. */
  followUpTime: string | null;
  notes: string;
  consents: PatientConsent[];
}

/** What opens the drawer prefilled (`?name=&phone=&fromLead=`, `S:31`; a picker's query). */
export interface PatientDrawerPrefill {
  /** The person's name as given: the first word fills First name, the rest Last name. */
  name?: string;
  /** Their mobile, E.164 or as typed. */
  phone?: string;
  /** The lead the patient comes from — the file opens on its person (`contact_id`). */
  leadId?: string;
  /** Their care types instead of Aesthetic — the booking's "Create patient record" (H:6039). */
  types?: readonly PatientType[];
  /** Notes to start with — the booking's Reason (H:6039). */
  notes?: string;
}

/** How the drawer takes the birth: a picked date, or an age in whole years — in the chips' order. */
export const PATIENT_BIRTH_MODES = ['date', 'age'] as const;

/** One of {@link PATIENT_BIRTH_MODES}. */
export type PatientBirthMode = (typeof PATIENT_BIRTH_MODES)[number];

/** The oldest age the desk can type — the API's bound. */
export const PATIENT_AGE_MAX = 120;

/** The form's own limits (`patients.md:44–58`): the contract allows more for address and notes. */
export const PATIENT_FORM_LIMITS = {
  name: 60,
  address: 200,
  referredBy: 30,
  notes: 1000,
} as const;

/**
 * The types a new patient starts with: Aesthetic, picked where it shows and
 * removable (H:4685). Never added on save — a patient saved with no type has
 * none (§6.5 quick-add: "a missing type no longer saves as Aesthetic").
 */
const NEW_PATIENT_TYPES: readonly PatientType[] = ['aesthetic'];

/** The hour a follow-up takes when only its day is picked — the quick chips' 11:00 (H:4716). */
export const FOLLOW_UP_HOUR = '11:00';

/** A name as First and Last: the first word, then the rest (`patients.md:76–77`). */
export function splitPatientName(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/**
 * A new patient's form: New and Aesthetic, nothing else picked, the prefill's
 * name and mobile — and its types and notes when a booking prefills them.
 */
export function emptyPatientForm(prefill: PatientDrawerPrefill = {}): PatientFormValues {
  const { firstName, lastName } = splitPatientName(prefill.name ?? '');
  return {
    firstName,
    lastName,
    phone: prefill.phone ? appPhoneDigits(prefill.phone) : '',
    phone2: '',
    address: '',
    homeBranchId: null,
    gender: null,
    birthMode: 'date',
    dateOfBirth: null,
    age: '',
    types: [...(prefill.types ?? NEW_PATIENT_TYPES)],
    status: 'new',
    conversion: null,
    referredByName: '',
    referralSource: null,
    followUpDate: null,
    followUpTime: null,
    notes: prefill.notes?.slice(0, PATIENT_FORM_LIMITS.notes) ?? '',
    consents: [],
  };
}

/** A saved patient's form, for Edit patient. */
export function patientFormOf(patient: PatientRecord): PatientFormValues {
  const followUp = patient.followUpAt ? new Date(patient.followUpAt) : null;
  return {
    firstName: patient.firstName,
    lastName: patient.lastName ?? '',
    phone: appPhoneDigits(patient.phone),
    phone2: patient.phone2 ? appPhoneDigits(patient.phone2) : '',
    address: patient.address ?? '',
    homeBranchId: patient.homeBranchId,
    gender: patient.gender,
    // An age the desk typed opens as that age, counted up to today; a real date as the date
    birthMode: patient.dateOfBirthIsApproximate ? 'age' : 'date',
    dateOfBirth: patient.dateOfBirthIsApproximate ? null : patient.dateOfBirth,
    age:
      patient.dateOfBirthIsApproximate && patient.age !== null ? String(patient.age) : '',
    types: [...patient.types],
    status: patient.status,
    conversion: patient.conversion,
    referredByName: patient.referredByName ?? '',
    referralSource: patient.referralSource,
    followUpDate: followUp ? appToday(followUp) : null,
    followUpTime: followUp ? appClockTime(followUp) : null,
    notes: patient.notes ?? '',
    consents: [...patient.consents],
  };
}

const textOrNull = (value: string) => value.trim() || null;

/**
 * The birth a form saves: the picked date in Birth date mode; in Age mode the typed whole years
 * (the server stores today minus them, flagged approximate) — or nothing when the age is empty.
 */
function birthInputOf(
  values: PatientFormValues,
): Pick<PatientFields, 'dateOfBirth' | 'age'> {
  if (values.birthMode === 'date') return { dateOfBirth: values.dateOfBirth, age: null };
  const age = values.age.trim();
  return age === ''
    ? { dateOfBirth: null, age: null }
    : { dateOfBirth: null, age: Number(age) };
}

/** A mobile field's digits as the contract stores them; the server answers a bad one with a 422. */
const storedPhone = (digits: string) => toAppPhone(digits) ?? digits;

/**
 * The fields a form saves (`POST /app/patients`, or the edit's two writes): text trimmed
 * (empty → none), mobiles in E.164, the follow-up as the instant of its clinic-local day and
 * time (11:00 when only the day is picked). The home branch is the picked one, else
 * `defaultBranchId` — without either the server names the field.
 */
export function patientInputOf(
  values: PatientFormValues,
  context: { defaultBranchId: string | null },
): PatientFields {
  return {
    firstName: values.firstName.trim(),
    lastName: textOrNull(values.lastName),
    phone: storedPhone(values.phone),
    phone2: values.phone2 ? storedPhone(values.phone2) : null,
    address: textOrNull(values.address),
    homeBranchId: values.homeBranchId ?? context.defaultBranchId ?? '',
    gender: values.gender,
    ...birthInputOf(values),
    types: values.types,
    status: values.status,
    conversion: values.conversion,
    referredByName: textOrNull(values.referredByName),
    referralSource: values.referralSource,
    followUpAt: values.followUpDate
      ? appInstant(values.followUpDate, values.followUpTime ?? FOLLOW_UP_HOUR)
      : null,
    notes: textOrNull(values.notes),
    consents: values.consents,
  };
}

/** The required fields (First name, Mobile) still empty — Save opens their step instead. */
export function missingPatientFields(
  values: Pick<PatientFormValues, 'firstName' | 'phone'>,
): ('firstName' | 'phone')[] {
  const missing: ('firstName' | 'phone')[] = [];
  if (!values.firstName.trim()) missing.push('firstName');
  if (!values.phone) missing.push('phone');
  return missing;
}

/** The mobiles that are filled but are not ten digits from 6–9 ("Enter a 10-digit mobile"). */
export function invalidPatientPhones(
  values: Pick<PatientFormValues, 'phone' | 'phone2'>,
): ('phone' | 'phone2')[] {
  return (['phone', 'phone2'] as const).filter(
    (field) => values[field] !== '' && toAppPhone(values[field]) === null,
  );
}

/** Whether the Age mode holds an age the API refuses — anything but a whole number from 0 to 120. */
export function isInvalidPatientAge(
  values: Pick<PatientFormValues, 'birthMode' | 'age'>,
): boolean {
  const age = values.age.trim();
  if (values.birthMode !== 'age' || age === '') return false;
  return !/^\d{1,3}$/.test(age) || Number(age) > PATIENT_AGE_MAX;
}

/** A patient's display name from the form: First and Last, as typed. */
export function patientFormName(
  values: Pick<PatientFormValues, 'firstName' | 'lastName'>,
): string {
  return [values.firstName.trim(), values.lastName.trim()].filter(Boolean).join(' ');
}

/** A Quick fill preset (`patients.md:172`, H:4719): what it sets, in its chip's tone. */
export interface PatientQuickFill {
  id: 'walkIn' | 'referred' | 'instagram' | 'lhr';
  tone: Tone;
  values: Partial<PatientFormValues>;
}

/** The New patient drawer's Quick fill, in order; each prefills, none saves. */
export const PATIENT_QUICK_FILLS: readonly PatientQuickFill[] = [
  {
    id: 'walkIn',
    tone: 'butter',
    values: {
      status: 'new',
      referralSource: 'walk_in',
      followUpDate: null,
      followUpTime: null,
    },
  },
  { id: 'referred', tone: 'lav', values: { referralSource: 'patient', status: 'new' } },
  {
    id: 'instagram',
    tone: 'blush',
    values: { referralSource: 'instagram', status: 'new' },
  },
  { id: 'lhr', tone: 'blush', values: { types: ['lhr'], status: 'new' } },
];

/** A Follow-up quick chip: a day and a time computed from today. */
export interface FollowUpPreset {
  id: 'tomorrow' | 'week' | 'twentyDays' | 'month';
  date: string;
  time: string;
}

/**
 * The Follow-up quick chips from the clinic's today (H:4716, §7.3 — the
 * prototype's fixed dates lose): tomorrow at 10:30, then a week, twenty days
 * and a calendar month ahead at 11:00.
 */
export function followUpPresets(today: string): FollowUpPreset[] {
  return [
    { id: 'tomorrow', date: addCivilDays(today, 1), time: '10:30' },
    { id: 'week', date: addCivilDays(today, 7), time: FOLLOW_UP_HOUR },
    { id: 'twentyDays', date: addCivilDays(today, 20), time: FOLLOW_UP_HOUR },
    { id: 'month', date: addCivilMonths(today, 1), time: FOLLOW_UP_HOUR },
  ];
}
