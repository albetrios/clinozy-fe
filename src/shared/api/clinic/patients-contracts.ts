import { z } from 'zod';

import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from './clinic-list-filters.ts';
import {
  civilDateSchema,
  genderSchema,
  isoDateTimeSchema,
  paiseSchema,
  patientConversionSchema,
  patientSchema,
  patientStatusSchema,
  patientTypeSchema,
  phoneSchema,
  referralSourceSchema,
  toneSchema,
} from './clinic-schema.ts';
import { clinicToday } from './clinic-time.ts';

/*
 * The Patients domain beyond the generated contract (KICKOFF §6.5, §3.6, D22):
 * the plan-only fields the list and the patient drawer show — each a fixture
 * field until clinozy-be serves it (Appendix F › Patients, REPLACE_WITH_API) —
 * what a client sends to create or update a patient, and the list read's
 * params. Read by the Patients room, the patient file, the patient pickers'
 * quick-add and ⌘K.
 */

// ── Records ──

/** The consent chips the drawer offers (Appendix F: a set replacing `consentGiven`). */
export const PATIENT_CONSENT_VALUES = ['data', 'photos', 'marketing'] as const;

/** Zod enum of one consent chip. */
export const patientConsentSchema = z.enum(PATIENT_CONSENT_VALUES);

/** One consent the patient signed. */
export type PatientConsent = z.infer<typeof patientConsentSchema>;

/** "Referred by" is a free-text name of at most 30 characters (`patients.md:55`). */
export const REFERRED_BY_MAX = 30;

/**
 * A patient as the rooms read it: the contract's `Patient` (`S:287–320`) with
 * the plan's fields (Appendix F, REPLACE_WITH_API) — the free-text "Referred
 * by", the Data / Photos / Marketing consent set (the contract's
 * `consentGiven` follows its Data chip), and who last saved the record
 * (`updatedById` on `_Common`). `conversion` keeps the contract's non-null
 * shape: a cleared chip saves as the contract default until clinozy-be makes it
 * nullable (Appendix F).
 */
export const patientRecordSchema = patientSchema.extend({
  referredByName: z.string().nullable(),
  consents: z.array(patientConsentSchema),
  updatedById: z.uuid(),
});

/** A patient record — the contract's fields and the plan's. */
export type PatientRecord = z.infer<typeof patientRecordSchema>;

/** The team member a row's "Updated" cell shows — embedded so a row renders without a join. */
export const patientUpdaterSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  initials: z.string(),
  tone: toneSchema,
});

/** Who last saved a patient. */
export type PatientUpdater = z.infer<typeof patientUpdaterSchema>;

/**
 * A list row: the record, what the patient owes the clinic across their open
 * invoices (integer paise; "per-row `dueTotal`", Appendix F) and the member who
 * last saved it (REPLACE_WITH_API: embed both in `listPatients`).
 */
export const patientRowSchema = patientRecordSchema.extend({
  dueTotal: paiseSchema,
  updatedBy: patientUpdaterSchema.nullable(),
});

/** A Patients list row. */
export type PatientRow = z.infer<typeof patientRowSchema>;

// ── Writes ──

/** The form's own limits, inside the contract's (`patients.md:44–58`; `S:295–312`). */
export const PATIENT_FIELD_LIMITS = {
  name: 60,
  /** The contract allows 240; the drawer's textarea stops at 200. */
  address: 240,
  /** The contract allows 2,000; the drawer's textarea stops at 1,000. */
  notes: 2000,
  /** The clinical bento cards (`complaints` … `futureSuggestions`). */
  clinical: 4000,
  email: 120,
} as const;

const MOBILE_MESSAGE = 'Enter a 10-digit mobile';
const BIRTH_DATE_MESSAGE = 'A birth date can’t be in the future';

/** An Indian mobile in E.164 — "Enter a 10-digit mobile" otherwise (`patients.md:74`). */
const mobileSchema = z
  .string()
  .refine((value) => phoneSchema.safeParse(value).success, MOBILE_MESSAGE);

/**
 * Every field a client sends for a patient (`createPatient` / `updatePatient`,
 * `S:1623, S:1640`) with the contract's ranges, plus the plan's (Appendix F):
 * `followUpAt` on create, a clearable `conversion` (none saves as the
 * contract's default, "T-Not converted"), `referredByName` and the consent
 * set. A birth date is never in the future (`S:301`).
 */
export const patientFieldsSchema = z.object({
  firstName: z.string().trim().min(1, 'Add a first name').max(PATIENT_FIELD_LIMITS.name),
  lastName: z.string().trim().max(PATIENT_FIELD_LIMITS.name).nullable(),
  phone: mobileSchema,
  phone2: mobileSchema.nullable(),
  email: z.email('Check the email').max(PATIENT_FIELD_LIMITS.email).nullable(),
  gender: genderSchema.nullable(),
  dateOfBirth: civilDateSchema
    .refine((date) => date <= clinicToday(), BIRTH_DATE_MESSAGE)
    .nullable(),
  address: z.string().trim().max(PATIENT_FIELD_LIMITS.address).nullable(),
  homeBranchId: z.uuid(),
  types: z.array(patientTypeSchema).max(6),
  status: patientStatusSchema,
  conversion: patientConversionSchema.nullable(),
  referralSource: referralSourceSchema.nullable(),
  referredByName: z.string().trim().max(REFERRED_BY_MAX).nullable(),
  referredByPatientId: z.uuid().nullable(),
  consents: z.array(patientConsentSchema),
  doctorId: z.uuid().nullable(),
  followUpAt: isoDateTimeSchema.nullable(),
  notes: z.string().trim().max(PATIENT_FIELD_LIMITS.notes).nullable(),
  leadId: z.uuid().nullable(),
});

/** A patient's full input — what a create stores and an update re-checks once merged. */
export type PatientFields = z.infer<typeof patientFieldsSchema>;

/** The clinical bento's four notes, written from the patient file (`updatePatient`, `S:1640`). */
export const patientClinicalSchema = z.object({
  complaints: z.string().trim().max(PATIENT_FIELD_LIMITS.clinical).nullable(),
  diagnosis: z.string().trim().max(PATIENT_FIELD_LIMITS.clinical).nullable(),
  treatmentSuggestions: z.string().trim().max(PATIENT_FIELD_LIMITS.clinical).nullable(),
  futureSuggestions: z.string().trim().max(PATIENT_FIELD_LIMITS.clinical).nullable(),
});

/** The clinical notes a patient-file save may send. */
export type PatientClinical = z.infer<typeof patientClinicalSchema>;

/**
 * A new patient's starting values (`S:295–312`; `patients.md:53`): New, no
 * types, no conversion until someone picks one, nothing signed; the home
 * branch is the caller's (the current branch, else the main one).
 */
export const PATIENT_DEFAULTS: Readonly<
  Omit<PatientFields, 'firstName' | 'phone' | 'homeBranchId'>
> = {
  lastName: null,
  phone2: null,
  email: null,
  gender: null,
  dateOfBirth: null,
  address: null,
  types: [],
  status: 'new',
  conversion: null,
  referralSource: null,
  referredByName: null,
  referredByPatientId: null,
  consents: [],
  doctorId: null,
  followUpAt: null,
  notes: null,
  leadId: null,
};

/**
 * A create: the first name and the mobile are enough to start; the home branch
 * falls back to the main one and the rest to {@link PATIENT_DEFAULTS}.
 */
export type PatientCreateInput = Pick<PatientFields, 'firstName' | 'phone'> &
  Partial<PatientFields>;

/** An update: any field of the drawer or the clinical bento; the server re-checks the merged record. */
export type PatientPatch = Partial<PatientFields & PatientClinical>;

/**
 * What a create answers: the patient, and the onboarding task it opened — "New
 * patient. Collect consent, DOB and a first photo." (H:4718; an Onboarding task
 * kind, Appendix F).
 */
export interface PatientCreateResult {
  patient: PatientRecord;
  onboardingTaskId: string;
}

// ── List reads ──

/**
 * The list's views (`view`, `S:30`): everyone; in clinic today (checked in
 * today, Q-P4); with dues; follow-up due (past or today); Recall (status
 * Inactive — prototype-only, a backend request, Appendix F).
 */
export const PATIENT_VIEW_VALUES = ['all', 'today', 'dues', 'follow', 'recall'] as const;

/** One list view. */
export type PatientView = (typeof PATIENT_VIEW_VALUES)[number];

/**
 * The sortable columns (`patients.md:30`): ID, Patient, Type, Status,
 * Conversion, Age, Follow-up, Due, Updated — each column's id. Without one the
 * list runs by `updatedAt`, newest first (`S:1619`).
 */
export const PATIENT_SORT_KEYS = [
  'seq',
  'name',
  'types',
  'status',
  'conversion',
  'age',
  'followUp',
  'due',
  'updated',
] as const;

/** One sortable column. */
export type PatientSortKey = (typeof PATIENT_SORT_KEYS)[number];

/**
 * `listPatients`' params (`S:1619`) and the plan's (`recall`, `gender`,
 * `conversion` and the extra sort keys — backend requests, Appendix F). The
 * badge filters take any number of values each.
 */
export const patientListParamsSchema = z.object({
  view: z.enum(PATIENT_VIEW_VALUES).optional(),
  q: z.string().max(80).optional(),
  types: z.array(patientTypeSchema).optional(),
  status: z.array(patientStatusSchema).optional(),
  gender: z.array(genderSchema).optional(),
  conversion: z.array(patientConversionSchema).optional(),
  created: z
    .custom<CreatedFilter>((value) => readCreatedFilter(value) !== undefined)
    .optional(),
  followUp: z
    .custom<FollowUpFilter>((value) => readFollowUpFilter(value) !== undefined)
    .optional(),
  sort: z.enum(PATIENT_SORT_KEYS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/** Params of the patients list read. */
export type PatientListParams = z.infer<typeof patientListParamsSchema>;

/** A patient's full name as every room shows it: "Priya Shah", or the first name alone. */
export function patientName(patient: Pick<PatientRecord, 'firstName' | 'lastName'>) {
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim();
}
