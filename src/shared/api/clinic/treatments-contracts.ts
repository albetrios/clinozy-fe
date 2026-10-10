import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

/*
 * A patient's treatments on clinozy-be (`/app/patients/:patient_id/treatments`, api-integration
 * §5.4): one session recorded for a patient — reversed with a reason, never deleted. A session
 * recorded for a package (`patient_offering_id`) spends one of its sessions and takes its number
 * from it; a reverse gives the session back (§6 #20). Each session carries its latest check-in.
 * The server counts and numbers the sessions; the file reads them (§7).
 */

type ApiTreatment = NonNullable<
  ApiData<'/app/patients/{patient_id}/treatments/{patient_treatment_id}', 'get'>
>;
type ApiTreatmentCreate = ApiBody<'/app/patients/{patient_id}/treatments', 'post'>;
type ApiTreatmentUpdate = ApiBody<
  '/app/patients/{patient_id}/treatments/{patient_treatment_id}',
  'patch'
>;
type ApiCheckIn = NonNullable<
  ApiData<'/app/patients/{patient_id}/check-ins', 'get'>
>[number];

// ── Values ──

/** The drawer's forms (`template`). */
const TREATMENT_TEMPLATE_VALUES = [
  'skin',
  'dental',
  'physio',
  'gynac',
  'general',
] as const;
/** One form. */
export type TreatmentTemplate = (typeof TREATMENT_TEMPLATE_VALUES)[number];

/** The body parts a session names (`body_parts`, the one 15-part list — M33). */
const TREATMENT_BODY_PART_VALUES = [
  'face',
  'upper_lip',
  'chin',
  'neck',
  'scalp',
  'hair',
  'chest',
  'back',
  'underarm',
  'arms',
  'hands',
  'legs',
  'body',
  'full_body',
  'other',
] as const;
/** One body part. */
export type TreatmentBodyPart = (typeof TREATMENT_BODY_PART_VALUES)[number];

/** When the aftercare call is due (`aftercare_call`). */
const TREATMENT_AFTERCARE_CALL_VALUES = [
  'none',
  'next_day',
  'in_two_days',
  'in_week',
] as const;
/** One aftercare call. */
export type TreatmentAftercareCall = (typeof TREATMENT_AFTERCARE_CALL_VALUES)[number];

/** A session is done, or reversed with a reason (never deleted). */
const TREATMENT_STATUS_VALUES = ['done', 'reversed'] as const;
/** One status. */
type TreatmentStatus = (typeof TREATMENT_STATUS_VALUES)[number];

/** How the patient feels at a check-in. */
const CHECK_IN_FEEL_VALUES = ['much_better', 'better', 'same', 'worse'] as const;

/** The API's limits on a session's fields (the drawer's Remark keeps the design's 1,000). */
export const TREATMENT_LIMITS = {
  name: 120,
  remark: 1000,
  /** Each template field's value. */
  parameter: 80,
  bodyParts: 12,
  session: { min: 1, max: 999 },
} as const;

// ── Records ──

const checkInSummaryShape = {
  id: z.string(),
  check_in_date: z.string(),
  feel: z.enum(CHECK_IN_FEEL_VALUES),
  score: z.number().int(),
};

/** A session as every treatments read answers it. */
export const treatmentWire = wireSchema<ApiTreatment>()(
  z.object({
    id: z.string(),
    patient_id: z.string(),
    appointment_id: z.string().nullable(),
    offering_id: z.string().nullable(),
    name: z.string(),
    template: z.enum(TREATMENT_TEMPLATE_VALUES),
    performed_at: z.string(),
    doctor_membership_id: z.string().nullable(),
    therapist_membership_id: z.string().nullable(),
    body_parts: z.array(z.enum(TREATMENT_BODY_PART_VALUES)),
    session_number: z.number().int(),
    parameters: z.record(z.string(), z.string()),
    remark: z.string().nullable(),
    aftercare_call: z.enum(TREATMENT_AFTERCARE_CALL_VALUES),
    patient_offering_id: z.string().nullable(),
    is_billed: z.boolean().nullable(),
    status: z.enum(TREATMENT_STATUS_VALUES),
    reversed_reason: z.string().nullable(),
    reversed_at: z.string().nullable(),
    latest_check_in: z.object(checkInSummaryShape).nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** A check-in as "Feedback on this treatment" reads it (`GET …/check-ins?patient_treatment_id=`). */
export const treatmentCheckInWire = wireSchema<ApiCheckIn>()(
  z.object(checkInSummaryShape),
);

/** One check-in on a session: its day, the feel and the score. */
export interface TreatmentCheckIn {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  feel: (typeof CHECK_IN_FEEL_VALUES)[number];
  /** 1–10. */
  score: number;
}

/** A patient's treatment session as the file reads it. */
export interface TreatmentRecord {
  /** The session's id (`trt_…`). */
  id: string;
  patientId: string;
  /** The visit it was recorded at. */
  appointmentId: string | null;
  offeringId: string | null;
  name: string;
  template: TreatmentTemplate;
  /** When it was done — an instant. */
  performedAt: string;
  /** The doctor's membership id. */
  doctorId: string | null;
  /** The therapist's membership id. */
  therapistId: string | null;
  bodyParts: TreatmentBodyPart[];
  sessionNumber: number;
  /** The template's fields, by key — each value text (≤ 80). */
  parameters: Record<string, string>;
  remark: string | null;
  aftercareCall: TreatmentAftercareCall;
  /** The patient's package it spent a session of (the patient offering); none once reversed. */
  packageId: string | null;
  /** Billed (true), still to bill (false), or nothing to bill (null) — the server's. */
  isBilled: boolean | null;
  status: TreatmentStatus;
  reversedReason: string | null;
  reversedAt: string | null;
  /** Its latest check-in — the table's Feedback. */
  latestCheckIn: TreatmentCheckIn | null;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** A check-in summary from the wire. */
export function toTreatmentCheckIn(
  row: z.output<typeof treatmentCheckInWire>,
): TreatmentCheckIn {
  return { id: row.id, date: row.check_in_date, feel: row.feel, score: row.score };
}

/** A session from the wire. */
export function toTreatmentRecord(row: z.output<typeof treatmentWire>): TreatmentRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    offeringId: row.offering_id,
    name: row.name,
    template: row.template,
    performedAt: row.performed_at,
    doctorId: row.doctor_membership_id,
    therapistId: row.therapist_membership_id,
    bodyParts: row.body_parts,
    sessionNumber: row.session_number,
    parameters: row.parameters,
    remark: row.remark,
    aftercareCall: row.aftercare_call,
    packageId: row.patient_offering_id,
    isBilled: row.is_billed,
    status: row.status,
    reversedReason: row.reversed_reason,
    reversedAt: row.reversed_at,
    latestCheckIn: row.latest_check_in ? toTreatmentCheckIn(row.latest_check_in) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Writes ──

/** What the drawer writes on a session. */
export interface TreatmentFields {
  name: string;
  template: TreatmentTemplate;
  offeringId: string | null;
  doctorId: string | null;
  therapistId: string | null;
  bodyParts: TreatmentBodyPart[];
  sessionNumber: number;
  parameters: Record<string, string>;
  remark: string | null;
  aftercareCall: TreatmentAftercareCall;
}

/** What a new session sends: its fields, where it was done, and the package it spends. */
export interface TreatmentCreateInput extends TreatmentFields {
  /** The visit it is recorded at — checked in or completed (the server's check). */
  appointmentId?: string | null;
  /** When it was done; the server's now without one. */
  performedAt?: string;
  /**
   * The patient's package it spends a session of (§6 #20): the server takes the session's
   * number and offering from it, so neither is sent.
   */
  packageId: string | null;
}

/** The body of `POST …/treatments`. */
export function treatmentCreateBodyOf(input: TreatmentCreateInput): ApiTreatmentCreate {
  const body: ApiTreatmentCreate = {
    name: input.name,
    template: input.template,
    doctor_membership_id: input.doctorId,
    therapist_membership_id: input.therapistId,
    body_parts: input.bodyParts,
    parameters: input.parameters,
    remark: input.remark,
    aftercare_call: input.aftercareCall,
  };
  if (input.appointmentId) body.appointment_id = input.appointmentId;
  if (input.performedAt) body.performed_at = input.performedAt;
  if (input.packageId) {
    body.patient_offering_id = input.packageId;
  } else {
    body.offering_id = input.offeringId;
    body.session_number = input.sessionNumber;
  }
  return body;
}

/**
 * The body of `PATCH …/treatments/:patient_treatment_id`. A session spent from a package keeps
 * its number and offering (the server refuses either), so neither is sent for one.
 */
export function treatmentUpdateBodyOf(
  fields: TreatmentFields,
  { fromPackage }: { fromPackage: boolean },
): ApiTreatmentUpdate {
  const body: ApiTreatmentUpdate = {
    name: fields.name,
    template: fields.template,
    doctor_membership_id: fields.doctorId,
    therapist_membership_id: fields.therapistId,
    body_parts: fields.bodyParts,
    parameters: fields.parameters,
    remark: fields.remark,
    aftercare_call: fields.aftercareCall,
  };
  if (!fromPackage) {
    body.offering_id = fields.offeringId;
    body.session_number = fields.sessionNumber;
  }
  return body;
}
