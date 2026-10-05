import { z } from 'zod';

import type { AppointmentRow } from './appointments-contracts.ts';
import {
  bodyPartSchema,
  clinicCommonSchema,
  deleteReasonSchema,
  type InvoiceType,
  isoDateTimeSchema,
  type Prescription,
  prescriptionItemSchema,
  type Tone,
  type Treatment,
} from './clinic-schema.ts';
import type { InvoiceRecord } from './invoices-contracts.ts';
import type { PatientRecord } from './patients-contracts.ts';

/**
 * The Visit (D18): one visit per patient in the clinic, from check-in to the
 * last desk step — the stage Today's floor shows it in, and the record the
 * Visit sheet and the patient file's flow both write. The schema has no Visit
 * entity (check-in is `Appointment.status = checked_in`, `S:341, 352`), so it
 * is plan-only — Appendix F's "a Visit entity (id, appointmentId, patientId,
 * stage …, stage timestamps, `lastSavedAt`); the consult note (complaint and
 * plan ≤ 120, findings, diagnosis[]); `getVisit`, `setVisitStage`,
 * `completeVisit`" — on the fixture server until clinozy-be serves it
 * (REPLACE_WITH_API). Today (L-48) moves its stage; the Visit sheet and the
 * file's flow (L-49) write its records.
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
 * The stage a tab's record leaves the visit in (D18: the stage is server-derived
 * from the records, `S:352`): the later of where it is and where the record
 * takes it — an Rx approved for a visit already at checkout leaves it there.
 */
export function stageAfter(current: VisitStage, target: VisitStage): VisitStage {
  return VISIT_STAGES.indexOf(target) > VISIT_STAGES.indexOf(current) ? target : current;
}

/** The three safety checks the file's flow asks at every visit (`patient-file.md:396`). */
export const VISIT_CHECKS = ['consent', 'photos', 'allergies'] as const;
/** One safety check. */
export type VisitCheck = (typeof VISIT_CHECKS)[number];

/** Which safety checks are done — the file's step 1 "Check-in & safety". */
export const visitChecksSchema = z.object({
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

/** The consult note's limits (`today.md:82–85`; Appendix F: complaint and plan ≤ 120). */
export const VISIT_NOTE_LIMITS = {
  complaint: 120,
  plan: 120,
  findings: 2000,
  diagnosis: 60,
  diagnoses: 12,
} as const;

/** The consult note — it belongs to the Visit (Appendix F), saved with the Rx at Approve. */
export const visitNoteSchema = z.object({
  complaint: z.string().trim().max(VISIT_NOTE_LIMITS.complaint),
  findings: z.string().trim().max(VISIT_NOTE_LIMITS.findings),
  diagnoses: z
    .array(z.string().trim().min(1).max(VISIT_NOTE_LIMITS.diagnosis))
    .max(VISIT_NOTE_LIMITS.diagnoses),
  plan: z.string().trim().max(VISIT_NOTE_LIMITS.plan),
});
/** A consult note. */
export type VisitNote = z.infer<typeof visitNoteSchema>;

/**
 * A stored visit: its booking (none for a visit started in the file with no
 * booking that day) and person, the stage it is in and when that stage began
 * ("In room 9 min", "since 10:40"); the file's safety checks; the consult note;
 * and the records its tabs wrote — the Rx, the session, the bill — and when the
 * Rx, invoice and photos went out on WhatsApp. `updatedAt` is its last save
 * ("All changes saved 10:42"). A checked-in booking with no record yet is a
 * visit still waiting — the record starts with its first move.
 */
export const visitRecordSchema = clinicCommonSchema.extend({
  id: z.uuid(),
  appointmentId: z.uuid().nullable(),
  patientId: z.uuid().nullable(),
  leadId: z.uuid().nullable(),
  stage: visitStageSchema,
  /** When the current stage began. */
  stageAt: isoDateTimeSchema,
  checks: visitChecksSchema,
  note: visitNoteSchema.nullable(),
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

/** A stage write's answer: the visit after it, and the token its Undo sends. */
export const visitChangeSchema = z.object({
  visit: visitRecordSchema,
  undoToken: z.string(),
});
/** A stage write's answer. */
export type VisitChange = z.infer<typeof visitChangeSchema>;

// ── The Visit sheet's read (`getVisit`, Appendix F) ──

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
 * The patient as the sheet's header band reads them: "F · 29 · PT-0412 · +91
 * 98250 ··· 41" and the consent chip (`today.md:134`).
 */
export type VisitPatient = Pick<
  PatientRecord,
  | 'id'
  | 'seq'
  | 'firstName'
  | 'lastName'
  | 'gender'
  | 'dateOfBirth'
  | 'phone'
  | 'consents'
  | 'leadId'
  | 'createdAt'
>;

/** An invoice the patient still owes on — the oldest before this visit ("Previous due · …"). */
export interface VisitOpenInvoice {
  id: string;
  seq: number;
  type: InvoiceType;
}

/**
 * What the Visit sheet and the file's flow read of one visit (`getVisit`,
 * Appendix F): the visit, its booking (the person, doctor, service, room), the
 * package it uses, whether a session is due, the records written at it (the
 * Rx, the session, the bill) and the ones before it the tabs build on (the
 * last Rx to copy, the last session's settings), the bill's lines and dues.
 */
export interface VisitDetail {
  visit: VisitRecord;
  booking: AppointmentRow | null;
  /** Who the visit is for — the booking's person, else the patient's name. */
  person: { name: string; patientId: string | null; leadId: string | null };
  /** The patient record; null for a lead's visit (no record yet). */
  patient: VisitPatient | null;
  pack: VisitPack | null;
  /** A session is due here: a treatment booking or a package session, none recorded yet. */
  sessionDue: boolean;
  /** The session recorded at this visit. */
  treatment: Treatment | null;
  /** The patient's session before this one — the settings table's "Session k−1". */
  lastTreatment: Treatment | null;
  /** The Rx approved at this visit. */
  prescription: Prescription | null;
  /** The patient's latest Rx before this visit — "Copy 12 Aug prescription". */
  lastPrescription: Prescription | null;
  /** The visit's Rx is approved and no sale has filled it yet — the pharmacy's. */
  rxToFill: boolean;
  /** The visit's bill once created. */
  invoice: InvoiceRecord | null;
  /** The lines the bill carries (its own once created). */
  billLines: VisitBillLine[];
  /** What is still to pay on the visit's bill, in paise (its total before it exists). */
  billDue: number;
  /** What the patient owes on their other invoices, and the oldest of them. */
  previousDue: { amount: number; invoice: VisitOpenInvoice | null };
}

// ── The tabs' writes (Appendix F; each one write, the stage server-derived) ──

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

/** The print languages ("Print in", `today.md:87`) — English only at launch (Q-X2). */
export const VISIT_PRINT_LANGUAGES = ['en'] as const;

/**
 * Consult & Rx's Approve (`today.md:78–93`): the note and the reviewed lines —
 * `createPrescription` with the visit's booking (`S:1641`) and the note on the
 * Visit, one write; the visit moves on (treatment or checkout).
 */
export const approveVisitRxInputSchema = z.object({
  visitId: z.uuid(),
  note: visitNoteSchema,
  items: z.array(prescriptionItemSchema).min(1, 'Add a medicine').max(30),
  language: z.enum(VISIT_PRINT_LANGUAGES),
});
/** An Approve. */
export type ApproveVisitRxInput = z.infer<typeof approveVisitRxInputSchema>;

/** The settings table's inputs (`today.md:99–101`: each ≤ 20). */
export const VISIT_SETTING_MAX = 20;

/**
 * Treatment's "Complete session" (`today.md:95–108`): today's settings and the
 * areas — `createTreatment` with the package and the session number
 * (`S:1642`; its day-2 aftercare call follows from it), one write.
 */
export const recordVisitSessionInputSchema = z.object({
  visitId: z.uuid(),
  params: z.record(z.string(), z.string().trim().max(VISIT_SETTING_MAX)),
  bodyParts: z.array(bodyPartSchema).max(12),
});
/** A Complete session. */
export type RecordVisitSessionInput = z.infer<typeof recordVisitSessionInputSchema>;

/** "Reverse with reason": the session soft-deleted with the reason confirm's choice (`S:1546`). */
export const reverseVisitSessionInputSchema = z.object({
  visitId: z.uuid(),
  reason: deleteReasonSchema,
  note: z.string().trim().max(500).nullable(),
});
/** A Reverse with reason. */
export type ReverseVisitSessionInput = z.infer<typeof reverseVisitSessionInputSchema>;

/** Checkout's "Create bill" and the flow's "Create invoice from visit": the visit's lines, one invoice. */
export const createVisitBillInputSchema = z.object({ visitId: z.uuid() });
/** A Create bill. */
export type CreateVisitBillInput = z.infer<typeof createVisitBillInputSchema>;

/** The modes Checkout takes in one tap (`today.md:114`); Split is the Receive drawer's (AMBER). */
export const VISIT_PAYMENT_MODES = ['upi', 'cash', 'card'] as const;
/** One Checkout mode. */
export type VisitPaymentMode = (typeof VISIT_PAYMENT_MODES)[number];

/** The amount field's limit (`today.md:115`: ≤ 9 digits of rupees). */
export const VISIT_AMOUNT_MAX_DIGITS = 9;

/**
 * Checkout's Receive (`today.md:110–121`): the amount in one mode, recorded
 * against the visit's bill and then the older dues — never twice (the fetch
 * client's idempotency key); the visit moves to the pharmacy or completes.
 */
export const receiveVisitPaymentInputSchema = z.object({
  visitId: z.uuid(),
  /** Paise. */
  amount: z.number().int().positive('Enter an amount'),
  mode: z.enum(VISIT_PAYMENT_MODES),
});
/** A Receive. */
export type ReceiveVisitPaymentInput = z.infer<typeof receiveVisitPaymentInputSchema>;

/** The visit's receipts: the first one's number, and the total recorded. */
export interface VisitReceipt {
  paymentSeq: number;
  amount: number;
  /** Where the visit went: the pharmacy (an Rx to fill) or done. */
  stage: VisitStage;
}

/** The file's "✓ Complete visit", and Checkout's when nothing is left to pay (`completeVisit`). */
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
 * What the Visit's tabs pick from (Appendix F: a diagnosis catalogue and the
 * per-doctor Rx quick-adds): the clinic's diagnoses and its Rx kits.
 */
export interface VisitCatalog {
  diagnoses: string[];
  kits: VisitRxKit[];
}
