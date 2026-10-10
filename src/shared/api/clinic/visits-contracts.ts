import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  type AppointmentRecord,
  appointmentRowWire,
  toAppointmentRecord,
} from './appointments-contracts.ts';
import type { AppointmentType } from './clinic-schema.ts';
import type { ClinicalNote } from './clinical-notes-contracts.ts';
import type { PatientPackageRow } from './patient-packages-contracts.ts';
import type { FloorStage } from './today-contracts.ts';

/*
 * The visit on clinozy-be (api-integration §5.1, §5.4; the backend's A10): there is no Visit
 * resource. A visit is the person's booking checked in today (`status = checked_in`): its floor
 * stage (`visit_stage`) moves forward only (`POST …/stage`), it pauses and resumes (`…/pause`,
 * `…/resume`) and `POST …/complete` closes it — the booking completed, off the floor. The flow's
 * safety checks are the patient's `safety_check` clinical notes written at the visit
 * (`appointment_id`, P12); the Rx and the session written at it are the patient's own records,
 * each carrying the booking's id.
 */

/** A checked-in visit's floor stages, in the API's order — the stage moves forward only. */
export const VISIT_STAGES = [
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
] as const satisfies readonly FloorStage[];
/** One floor stage. */
type VisitStage = (typeof VISIT_STAGES)[number];

/**
 * The stage a move to `target` lands on: `target` when it is later than `current`, else null —
 * the API refuses a move to the same or an earlier stage (`409 transition_not_allowed`).
 */
export function stageAfter(current: VisitStage, target: VisitStage): VisitStage | null {
  return VISIT_STAGES.indexOf(target) > VISIT_STAGES.indexOf(current) ? target : null;
}

type ApiAppointmentRow = NonNullable<ApiData<'/app/appointments', 'get'>>[number];

/**
 * A checked-in booking as the visit reads it: the booking, its stage (set while checked in, the
 * table's CHECK), when the stage began, and since when it is paused.
 */
export const visitWire = wireSchema<ApiAppointmentRow>()(
  appointmentRowWire.extend({
    visit_stage: z.enum(VISIT_STAGES),
    visit_stage_changed_at: z.string().nullable(),
    visit_paused_at: z.string().nullable(),
  }),
);

/** The patient's visit open today — one checked-in booking. */
export interface VisitRecord {
  /** The booking checked in — the visit's id (`appt_…`); the records written at it carry it. */
  appointmentId: string;
  /** The booking as the rooms read it: the person, branch, doctor, type and service. */
  booking: AppointmentRecord;
  stage: VisitStage;
  /** When the current stage began. */
  stageAt: string | null;
  /** Since when the visit is paused; null while it runs. */
  pausedAt: string | null;
}

/** A visit from the wire. */
export function toVisitRecord(row: z.output<typeof visitWire>): VisitRecord {
  return {
    appointmentId: row.id,
    booking: toAppointmentRecord(row),
    stage: row.visit_stage,
    stageAt: row.visit_stage_changed_at,
    pausedAt: row.visit_paused_at,
  };
}

// ── The safety checks ──

/** The three safety checks the flow asks at every visit (`patient-file.md:396`). */
export const VISIT_CHECKS = ['consent', 'photos', 'allergies'] as const;
/** One safety check. */
export type VisitCheck = (typeof VISIT_CHECKS)[number];

/**
 * Each check's `safety_check` note text — the design's words, the same in every language: a
 * note is free text with no check type (a gap, G4), so its text is how the flow knows which
 * check it records.
 */
export const VISIT_CHECK_NOTE_TEXTS: Readonly<Record<VisitCheck, string>> = {
  consent: 'Consent signed',
  photos: 'Before photos taken',
  allergies: 'Allergies & medicines checked',
};

/** Each check's note at the visit — null while the check is not done. */
export type VisitChecks = Readonly<Record<VisitCheck, ClinicalNote | null>>;

/** The checks the visit's `safety_check` notes record — the first note of each check's text. */
export function visitChecksOf(notes: readonly ClinicalNote[]): VisitChecks {
  const noteOf = (check: VisitCheck) =>
    notes.find(
      (note) =>
        note.kind === 'safety_check' && note.text === VISIT_CHECK_NOTE_TEXTS[check],
    ) ?? null;
  return {
    consent: noteOf('consent'),
    photos: noteOf('photos'),
    allergies: noteOf('allergies'),
  };
}

// ── The stage after a record (Q8) ──

/** A record written at the visit that moves it on: an Rx, or a session. */
export type VisitRecordKind = 'prescription' | 'treatment';

/** The booking types a session is booked for. */
const SESSION_TYPES: ReadonlySet<AppointmentType> = new Set([
  'treatment',
  'package_session',
]);

/** The stages a session can still be due in — from Checkout on, the session question is closed. */
const SESSION_STAGES: ReadonlySet<VisitStage> = new Set([
  'waiting',
  'with_doctor',
  'treatment',
]);

/** What decides whether a session is still due at the visit. */
interface VisitSessionFacts {
  visit: Pick<VisitRecord, 'stage' | 'booking'>;
  /** A session was recorded at the visit (a treatment carrying its booking). */
  sessionRecorded: boolean;
  /** The patient's packages — the server's status and sessions left. */
  packages: readonly Pick<PatientPackageRow, 'status' | 'sessionsLeft'>[];
}

/**
 * A session is still due at the visit (`today.md:160`, "a visit with a pending session"): none
 * recorded at it yet, before Checkout, and the booking is for a session — or, for a patient whose
 * package can still spend one (the server's status and count), any booking but a consultation.
 */
export function isSessionDue({
  visit,
  sessionRecorded,
  packages,
}: VisitSessionFacts): boolean {
  if (sessionRecorded || !SESSION_STAGES.has(visit.stage)) return false;
  const { type } = visit.booking;
  const holdsPackage = packages.some(
    (row) => row.status === 'active' && row.sessionsLeft > 0,
  );
  return SESSION_TYPES.has(type) || (holdsPackage && type !== 'consultation');
}

/**
 * Where a record written at the visit moves it (Q8 — the plan's proposal, pending the user: the
 * client calls `…/stage` after the write): an Rx to Treatment while a session is due, else to
 * Checkout; a session to Checkout. Null when the visit is there or further on already — never
 * backwards.
 */
export function stageAfterRecord(
  kind: VisitRecordKind,
  { visit, sessionDue }: { visit: Pick<VisitRecord, 'stage'>; sessionDue: boolean },
): VisitStage | null {
  const target = kind === 'prescription' && sessionDue ? 'treatment' : 'checkout';
  return stageAfter(visit.stage, target);
}
