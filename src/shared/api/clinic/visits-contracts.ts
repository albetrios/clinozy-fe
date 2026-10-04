import { z } from 'zod';

import { clinicCommonSchema, isoDateTimeSchema } from './clinic-schema.ts';

/**
 * The Visit (D18): one visit per checked-in booking, from check-in to the
 * last desk step — the stage Today's floor shows it in. The schema has no
 * Visit entity (check-in is `Appointment.status = checked_in`, `S:341, 352`),
 * so it is plan-only — Appendix F's "a Visit entity (id, appointmentId,
 * patientId, stage waiting / with doctor / treatment / checkout / pharmacy /
 * done, stage timestamps)" — on the fixture server until clinozy-be serves it
 * (REPLACE_WITH_API). Today (L-48) moves its stage; the Visit sheet (L-49)
 * grows the record.
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
 * A stored visit: its booking and person, the stage it is in and when that
 * stage began ("In room 9 min", "since 10:40"). A checked-in booking with no
 * record yet is a visit still waiting — the record starts with its first move.
 */
export const visitRecordSchema = clinicCommonSchema.extend({
  id: z.uuid(),
  appointmentId: z.uuid(),
  patientId: z.uuid().nullable(),
  leadId: z.uuid().nullable(),
  stage: visitStageSchema,
  /** When the current stage began. */
  stageAt: isoDateTimeSchema,
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
