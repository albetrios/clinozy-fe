import { z } from 'zod';

import type { AppointmentRow } from './appointments-contracts.ts';
import {
  clinicCommonSchema,
  isoDateTimeSchema,
  type Prescription,
  type prescriptionItemSchema,
  type Tone,
  type Treatment,
} from './clinic-schema.ts';
import type { InvoiceRecord } from './invoices-contracts.ts';

/**
 * The Visit (D18): one visit per patient in the clinic, from check-in to the
 * last desk step — the stage Today's floor shows it in, and the record the
 * patient file's visit flow writes. The schema has no Visit
 * entity (check-in is `Appointment.status = checked_in`, `S:341, 352`), so it
 * is plan-only — Appendix F's "a Visit entity (id, appointmentId, patientId,
 * stage …, stage timestamps, `lastSavedAt`); `getVisit`, `setVisitStage`,
 * `completeVisit`" — on the fixture server until clinozy-be serves it
 * (REPLACE_WITH_API). Today (L-48) moves its stage; the file's flow (L-49)
 * and the patient's own drawers write its records, which move it on (L-64).
 * No consult note is kept: the Visit sheet that wrote one is gone (L-64).
 */

/** A visit's stages, in floor order (`today.md:157–165`); `done` is off the floor. */
export const VISIT_STAGES = [
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
  'done',
] as const;
/** Zod enum of the stages. */
export const visitStageSchema = z.enum(VISIT_STAGES);
/** One stage. */
export type VisitStage = z.infer<typeof visitStageSchema>;

/**
 * The stage machine (KICKOFF §6.2): waiting → Send in → with doctor → Approve →
 * treatment (a pending session) or checkout → Complete session → checkout →
 * Receive → pharmacy (an Rx to fill) or done → Dispense → done. The server
 * refuses any other move (409).
 */
export const VISIT_STAGE_FLOW: Readonly<Record<VisitStage, readonly VisitStage[]>> = {
  waiting: ['with_doctor'],
  with_doctor: ['treatment', 'checkout'],
  treatment: ['checkout'],
  checkout: ['pharmacy', 'done'],
  pharmacy: ['done'],
  done: [],
};

/** Whether a visit may move from one stage to another. */
export function canMoveVisit(from: VisitStage, to: VisitStage): boolean {
  return VISIT_STAGE_FLOW[from].includes(to);
}

/**
 * The stage a record written at the visit leaves it in (D18: the stage is
 * server-derived from the records, `S:352`): the later of where it is and where
 * the record takes it — an Rx written for a visit already at checkout leaves it there.
 */
export function stageAfter(current: VisitStage, target: VisitStage): VisitStage {
  return VISIT_STAGES.indexOf(target) > VISIT_STAGES.indexOf(current) ? target : current;
}

/** The three safety checks the file's flow asks at every visit (`patient-file.md:396`). */
export const VISIT_CHECKS = ['consent', 'photos', 'allergies'] as const;
/** One safety check. */
export type VisitCheck = (typeof VISIT_CHECKS)[number];

/** Which safety checks are done — the file's step 1 "Check-in & safety". */
const visitChecksSchema = z.object({
  consent: z.boolean(),
  photos: z.boolean(),
  allergies: z.boolean(),
});
/** The safety checks of a visit. */
export type VisitChecks = z.infer<typeof visitChecksSchema>;

/** None of the checks done — where a visit starts. */
export const NO_VISIT_CHECKS: VisitChecks = {
  consent: false,
  photos: false,
  allergies: false,
};

/**
 * A stored visit: its booking (none for a visit started in the file with no
 * booking that day) and person, the stage it is in and when that stage began
 * ("In room 9 min", "since 10:40"); the file's safety checks; the records it
 * links — the Rx, the session, the bill — and when the Rx, invoice and photos
 * went out on WhatsApp. `updatedAt` is its last save. A checked-in booking
 * with no record yet is a visit still waiting — the record starts with its
 * first move.
 */
const visitRecordSchema = clinicCommonSchema.extend({
  id: z.uuid(),
  appointmentId: z.uuid().nullable(),
  patientId: z.uuid().nullable(),
  leadId: z.uuid().nullable(),
  stage: visitStageSchema,
  /** When the current stage began. */
  stageAt: isoDateTimeSchema,
  checks: visitChecksSchema,
  prescriptionId: z.uuid().nullable(),
  treatmentId: z.uuid().nullable(),
  invoiceId: z.uuid().nullable(),
  sharedAt: isoDateTimeSchema.nullable(),
});
/** A stored visit. */
export type VisitRecord = z.infer<typeof visitRecordSchema>;

/** Move a checked-in booking's visit to a stage (`setVisitStage`, Appendix F). */
export const setVisitStageInputSchema = z.object({
  appointmentId: z.uuid(),
  stage: visitStageSchema,
});
/** A stage write. */
export type SetVisitStageInput = z.infer<typeof setVisitStageInputSchema>;

/**
 * A stage write's answer: the visit after it, and the token its Undo sends.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const visitChangeSchema = z.object({
  visit: visitRecordSchema,
  undoToken: z.string(),
});
/** A stage write's answer. */
export type VisitChange = z.infer<typeof visitChangeSchema>;

// ── The visit's read (`getVisit`, Appendix F) ──

/** The package a visit uses a session of: its name, sessions, sale day and validity. */
export interface VisitPack {
  id: string;
  name: string;
  sessionsTotal: number;
  sessionsUsed: number;
  /** The clinic day it was sold — "bought 2 Jul". */
  soldOn: string;
  validUntil: string;
}

/**
 * One line of the visit's bill, pulled from the visit — "nothing retyped"
 * (`today.md:263`): the booking's service, the session recorded (₹0 when a
 * package carries it) — never the medicines, which Medical bills apart until
 * the combined-bill decision (`today.md:264`).
 */
export interface VisitBillLine {
  name: string;
  offeringId: string | null;
  qty: number;
  /** Rate in paise. */
  rate: number;
  discountPct: number;
  gstPct: number;
  /** A session a package carries — "₹0 · From pack · no charge". */
  fromPack: boolean;
}

/**
 * What the file's flow reads of one visit (`getVisit`, Appendix F): the visit,
 * its booking (the person, doctor, service, room), the package it uses,
 * whether a session is due, the records written at it (the Rx, the session,
 * the bill), the last session the flow repeats, and the bill's lines.
 */
export interface VisitDetail {
  visit: VisitRecord;
  booking: AppointmentRow | null;
  /** Who the visit is for — the booking's person, else the patient's name. */
  person: { name: string; patientId: string | null; leadId: string | null };
  pack: VisitPack | null;
  /** A session is due here: a treatment booking or a package session, none recorded yet. */
  sessionDue: boolean;
  /** The session recorded at this visit. */
  treatment: Treatment | null;
  /** The patient's session before this one — the flow's "⚡ Repeat" and its settings. */
  lastTreatment: Treatment | null;
  /** The Rx written at this visit. */
  prescription: Prescription | null;
  /** The visit's Rx is written and no sale has filled it yet — the pharmacy's. */
  rxToFill: boolean;
  /** The visit's bill once created. */
  invoice: InvoiceRecord | null;
  /** The lines the bill carries (its own once created). */
  billLines: VisitBillLine[];
}

// ── The flow's writes (Appendix F; each one write, the stage server-derived) ──

/** "Start visit" in the file: the patient's open visit, or a new one (D18). */
export const startVisitInputSchema = z.object({ patientId: z.uuid() });
/** A Start visit. */
export type StartVisitInput = z.infer<typeof startVisitInputSchema>;

/** The file's step 1: tick or untick safety checks. */
export const setVisitChecksInputSchema = z.object({
  visitId: z.uuid(),
  checks: visitChecksSchema.partial(),
});
/** A checks write. */
export type SetVisitChecksInput = z.infer<typeof setVisitChecksInputSchema>;

/** The flow's "Create invoice from visit": the visit's lines, one invoice. */
export const createVisitBillInputSchema = z.object({ visitId: z.uuid() });
/** A Create bill. */
export type CreateVisitBillInput = z.infer<typeof createVisitBillInputSchema>;

/** The modes the flow's Collect takes in one tap (`today.md:114`); Split is the Receive drawer's (AMBER). */
export const VISIT_PAYMENT_MODES = ['upi', 'cash', 'card'] as const;
/** One Collect mode. */
export type VisitPaymentMode = (typeof VISIT_PAYMENT_MODES)[number];

/**
 * The records a visit follows (D18: the stage follows the records, `S:352`):
 * an Rx written at it moves it to Treatment when a session is due, else to
 * Checkout; a session to Checkout; a receipt at Checkout to the pharmacy while
 * its Rx is still to fill, else — its bill paid in full — to done.
 */
export type VisitRecordKind = 'prescription' | 'treatment' | 'payment';

/** The file's "✓ Complete visit" (`completeVisit`). */
export const completeVisitInputSchema = z.object({ visitId: z.uuid() });
/** A Complete visit. */
export type CompleteVisitInput = z.infer<typeof completeVisitInputSchema>;

/** What a completed visit did — the toast's parts, each only when it happened. */
export interface VisitCompletion {
  visit: VisitRecord;
  /** The visit's session came out of a package. */
  packageSessionUsed: boolean;
  /** The follow-up the visit's Rx set (its `followUpDate`). */
  followUpDate: string | null;
}

/** The file's "Share Rx, invoice & photos" (WhatsApp; plan-only). */
export const shareVisitInputSchema = z.object({ visitId: z.uuid() });
/** A Share. */
export type ShareVisitInput = z.infer<typeof shareVisitInputSchema>;

/** A one-tap Rx kit (the file's step 2, H:4876): a name, a tone and its lines. */
export interface VisitRxKit {
  key: string;
  name: string;
  /** Its chip's tone (H:4876): Hair fall lav, Post-peel blush, Pigmentation butter. */
  tone: Tone;
  items: z.infer<typeof prescriptionItemSchema>[];
}

/**
 * What the flow picks from (Appendix F: a diagnosis catalogue and the
 * per-doctor Rx quick-adds): the clinic's diagnoses and its Rx kits.
 */
export interface VisitCatalog {
  diagnoses: string[];
  kits: VisitRxKit[];
}
