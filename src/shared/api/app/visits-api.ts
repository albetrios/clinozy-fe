import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import { appToday } from './app-time.ts';
import { appointmentQueryKeys, moveAppointment } from './appointments-api.ts';
import {
  APPOINTMENT_TYPE_MINUTES,
  APPOINTMENT_TYPE_SERVICES,
  appointmentRowWire,
} from './appointments-contracts.ts';
import { clinicalNoteQueryKeys, deleteClinicalNote } from './clinical-notes-api.ts';
import {
  type ClinicalNote,
  clinicalNoteWire,
  toClinicalNote,
} from './clinical-notes-contracts.ts';
import { patientFileQueryKeys } from './patient-file-api.ts';
import {
  toVisitRecord,
  VISIT_CHECK_NOTE_TEXTS,
  type VisitCheck,
  type VisitRecord,
  visitWire,
} from './visits-contracts.ts';

/*
 * The visit on clinozy-be (api-integration §5.1, §5.4): a visit is the person's booking checked
 * in today — read from `GET /app/appointments` (`contact_id`, today, `status=checked_in`),
 * started by a check-in of today's booking (`POST …/check-in`, the appointments layer's move)
 * or a walk-in (`POST /app/appointments` `{is_walk_in}`), paused and resumed (`…/pause`,
 * `…/resume`). Its safety checks are `safety_check` clinical notes written at it. Every write
 * carries the user action's key.
 */

/** The visit reads' keys, each carrying the organization. */
export const visitQueryKeys = {
  /**
   * Every open-visit read — under the appointments prefix, so any booking write (a check-in on
   * Today, a stage move, a complete) refreshes it.
   */
  all: [...appointmentQueryKeys.all, 'visits'] as const,
  /** A person's visit open today. */
  open: (organizationId: string | null, contactId: string) =>
    [...visitQueryKeys.all, organizationId, 'open', contactId] as const,
  /** A visit's safety checks — under the clinical notes' prefix, which every note write refreshes. */
  checks: (organizationId: string | null, patientId: string, appointmentId: string) =>
    [
      ...clinicalNoteQueryKeys.all,
      organizationId,
      'visit-checks',
      patientId,
      appointmentId,
    ] as const,
};

/**
 * What a write at a visit may have changed: every booking read (the open visit, Today's floor,
 * the person's Visits) and the patient file (its next visit, its Start visit / Resume).
 */
export const VISIT_WRITE_KEYS = [
  appointmentQueryKeys.all,
  patientFileQueryKeys.all,
] as const;

/** The person's bookings today in the given statuses, by start (the API's default sort). */
async function readTodaysBookings(contactId: string, status: string) {
  const today = appToday();
  const response = await api.get('/app/appointments', {
    query: {
      contact_id: contactId,
      appointment_date_from: today,
      appointment_date_to: today,
      status,
    },
  });
  return response.data ?? [];
}

/** The person's visit open today — their booking checked in today — or null. */
export async function fetchOpenVisit(contactId: string): Promise<VisitRecord | null> {
  const [row] = z
    .array(visitWire)
    .parse(await readTodaysBookings(contactId, 'checked_in'));
  return row ? toVisitRecord(row) : null;
}

/** Who a Start visit is for and, should it need a walk-in, where and with whom. */
interface StartVisitInput {
  contactId: string;
  /** The walk-in's branch — the patient's home branch. */
  branchId: string;
  /** The walk-in's doctor (a membership id). */
  doctorId: string;
  idempotencyKey: string;
}

/** What a Start visit did: the visit was already open, today's booking checked in, or a walk-in booked. */
export type StartVisitOutcome = 'open' | 'checked_in' | 'walk_in';

/**
 * "Start visit": the visit already open stays as it is; else the person's first booking of today
 * still to come (scheduled or confirmed) is checked in; else a walk-in is booked — today at now
 * and checked in at once by the server — as a consultation with the doctor at the branch. The
 * check-in also moves the person's lead to `clinic_visited` on the server — the open one, or one
 * closed as Lost or Not interested in the last 90 days (clinozy-be D2). Answers what it did.
 */
export async function startVisit({
  contactId,
  branchId,
  doctorId,
  idempotencyKey,
}: StartVisitInput): Promise<StartVisitOutcome> {
  if (await fetchOpenVisit(contactId)) return 'open';
  const [booked] = z
    .array(appointmentRowWire)
    .parse(await readTodaysBookings(contactId, 'scheduled,confirmed'));
  if (booked) {
    await moveAppointment({
      appointmentId: booked.id,
      route: 'check-in',
      idempotencyKey,
    });
    return 'checked_in';
  }
  await api.post('/app/appointments', {
    body: {
      contact_id: contactId,
      branch_id: branchId,
      doctor_membership_id: doctorId,
      is_walk_in: true,
      type: 'consultation',
      service_label: APPOINTMENT_TYPE_SERVICES.consultation,
      duration_minutes: APPOINTMENT_TYPE_MINUTES.consultation,
    },
    idempotencyKey,
  });
  return 'walk_in';
}

/** Pause a running visit, or resume a paused one — `409 transition_not_allowed` when it already is. */
export async function setVisitPaused({
  appointmentId,
  paused,
  idempotencyKey,
}: {
  appointmentId: string;
  paused: boolean;
  idempotencyKey: string;
}): Promise<VisitRecord> {
  const response = await api.post(
    paused
      ? '/app/appointments/{appointment_id}/pause'
      : '/app/appointments/{appointment_id}/resume',
    { params: { appointment_id: appointmentId }, idempotencyKey },
  );
  return toVisitRecord(visitWire.parse(response.data));
}

// ── The safety checks ──

/** Where a visit's safety checks are written: the patient and the visit's booking. */
export interface VisitCheckTarget {
  patientId: string;
  appointmentId: string;
}

/** The visit's `safety_check` notes, oldest first — one page holds a visit's three. */
export async function fetchVisitCheckNotes({
  patientId,
  appointmentId,
}: VisitCheckTarget): Promise<ClinicalNote[]> {
  const response = await api.get('/app/patients/{patient_id}/clinical-notes', {
    params: { patient_id: patientId },
    query: {
      kind: 'safety_check',
      appointment_id: appointmentId,
      sort: 'created_at',
      order: 'asc',
    },
  });
  return z
    .array(clinicalNoteWire)
    .parse(response.data ?? [])
    .map(toClinicalNote);
}

/** Record a check done at the visit — its `safety_check` note, tied to the booking. */
export async function recordVisitCheck({
  patientId,
  appointmentId,
  check,
  idempotencyKey,
}: VisitCheckTarget & {
  check: VisitCheck;
  idempotencyKey: string;
}): Promise<ClinicalNote> {
  const response = await api.post('/app/patients/{patient_id}/clinical-notes', {
    params: { patient_id: patientId },
    body: {
      kind: 'safety_check',
      text: VISIT_CHECK_NOTE_TEXTS[check],
      appointment_id: appointmentId,
    },
    idempotencyKey,
  });
  return toClinicalNote(clinicalNoteWire.parse(response.data));
}

/** Untick a check — its note deleted with the reason `not_needed`, as a removed chip is (Q24). */
export async function removeVisitCheck({
  patientId,
  noteId,
}: {
  patientId: string;
  noteId: string;
}): Promise<void> {
  await deleteClinicalNote({ patientId, noteId, reason: 'not_needed' });
}
