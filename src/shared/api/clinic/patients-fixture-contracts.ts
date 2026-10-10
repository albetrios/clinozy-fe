import { z } from 'zod';

import {
  type CreatedFilter,
  type FollowUpFilter,
  readCreatedFilter,
  readFollowUpFilter,
} from './clinic-list-filters.ts';
import {
  genderSchema,
  paiseSchema,
  patientConversionSchema,
  patientSchema,
  patientStatusSchema,
  patientTypeSchema,
  toneSchema,
} from './clinic-schema.ts';

/*
 * The fixture patients beyond the generated contract (KICKOFF §6.5, §3.6, D22): the plan-only
 * fields — each a fixture field until clinozy-be serves it (Appendix F › Patients,
 * REPLACE_WITH_API) — and the list read's params. Read by the rooms still on fixtures (Payments,
 * Medical, Tasks) and their patient pickers; the Patients room reads `patients-contracts.ts`.
 */

// ── Records ──

/** The consent chips the drawer offers (Appendix F: a set replacing `consentGiven`). */
const PATIENT_CONSENT_VALUES = ['data', 'photos', 'marketing'] as const;

/** Zod enum of one consent chip. */
const patientConsentSchema = z.enum(PATIENT_CONSENT_VALUES);

/** One consent the patient signed. */
export type PatientConsent = z.infer<typeof patientConsentSchema>;

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
const patientUpdaterSchema = z.object({
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
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const patientRowSchema = patientRecordSchema.extend({
  dueTotal: paiseSchema,
  updatedBy: patientUpdaterSchema.nullable(),
});

/** A Patients list row. */
export type PatientRow = z.infer<typeof patientRowSchema>;

// ── List reads ──

/**
 * The list's views (`view`, `S:30`): everyone; in clinic today (checked in
 * today, Q-P4); with dues; follow-up due (past or today); Recall (status
 * Inactive — prototype-only, a backend request, Appendix F).
 */
const PATIENT_VIEW_VALUES = ['all', 'today', 'dues', 'follow', 'recall'] as const;

/**
 * The sortable columns (`patients.md:30`): ID, Patient, Type, Status,
 * Conversion, Age, Follow-up, Due, Updated — each column's id. Without one the
 * list runs by `updatedAt`, newest first (`S:1619`).
 */
const PATIENT_SORT_KEYS = [
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
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
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
