import {
  clinicHttpError,
  type FixtureChange,
  recordFixtureChange,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import {
  canMoveVisit,
  type SetVisitStageInput,
  setVisitStageInputSchema,
  type VisitChange,
  type VisitRecord,
  type VisitStage,
} from '@/shared/api/clinic/visits-contracts.ts';

import { clinicFixtures, onClinicFixturesReset } from './world.fixtures.ts';

/**
 * The Visit fixture server (D18; Appendix F "a Visit entity … `setVisitStage`
 * … Undo of a check-in" — REPLACE_WITH_API). A checked-in booking's visit
 * moves through the stage machine (`VISIT_STAGE_FLOW`); the first move starts
 * its record. Every write answers an Undo token that puts it back.
 * `visits-api.ts` loads this module on demand; when the API lands, it goes.
 */

const undoLog = new Map<string, FixtureChange>();
onClinicFixturesReset(() => undoLog.clear());

/** The stages as the server's refusals name them. */
const STAGE_TEXT: Readonly<Record<VisitStage, string>> = {
  waiting: 'Waiting',
  with_doctor: 'With doctor',
  treatment: 'Treatment',
  checkout: 'Checkout',
  pharmacy: 'Pharmacy',
  done: 'Done',
};

/** A booking's visit record, or undefined before its first move. */
export function visitOfAppointment(appointmentId: string): VisitRecord | undefined {
  return clinicFixtures.visits.snapshot(
    (visit) => visit.appointmentId === appointmentId,
  )[0];
}

/**
 * Move a checked-in booking's visit (`setVisitStage`): 409 unless the booking
 * is checked in and the stage machine allows the move; the first move creates
 * the visit (Waiting until then). Answers the visit and an Undo token.
 */
export async function setVisitStage(raw: SetVisitStageInput): Promise<VisitChange> {
  const input = validateClinicInput(setVisitStageInputSchema, raw);
  const now = new Date().toISOString();
  const booking = await clinicFixtures.appointments.get(input.appointmentId);
  if (booking.status !== 'checked_in') {
    throw clinicHttpError(409, 'not_checked_in', 'Check them in first');
  }
  const current = visitOfAppointment(booking.id);
  const from = current?.stage ?? 'waiting';
  if (!canMoveVisit(from, input.stage)) {
    throw clinicHttpError(
      409,
      'invalid_transition',
      `${STAGE_TEXT[from]} can’t move to ${STAGE_TEXT[input.stage]}`,
    );
  }
  const change = recordFixtureChange();
  const visit = current
    ? await change.update(clinicFixtures.visits, current.id, {
        stage: input.stage,
        stageAt: now,
      })
    : await change.create(clinicFixtures.visits, {
        appointmentId: booking.id,
        patientId: booking.patientId,
        leadId: booking.leadId,
        stage: input.stage,
        stageAt: now,
      });
  const undoToken = crypto.randomUUID();
  undoLog.set(undoToken, change);
  return { visit, undoToken };
}

/** Undo a stage write — the visit goes back to where it was (each token works once). */
export async function undoVisitChange(undoToken: string): Promise<void> {
  const change = undoLog.get(undoToken);
  if (!change) {
    throw clinicHttpError(409, 'undo_unavailable', 'This change can no longer be undone');
  }
  undoLog.delete(undoToken);
  await change.reverse();
}
