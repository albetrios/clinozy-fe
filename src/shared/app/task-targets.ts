import {
  organizationAppointment,
  organizationAppointmentCreate,
} from '@/lib/routes/appointments-builders.ts';
import { organizationLead } from '@/lib/routes/leads-builders.ts';
import {
  organizationCheckInCreate,
  organizationCheckInEdit,
  organizationReviewCreate,
  organizationReviewEdit,
} from '@/lib/routes/patient-file-builders.ts';
import type { TaskFollowOnForm, TaskRow } from '@/shared/api/app/tasks-contracts.ts';

import {
  APP_COMMAND_TARGETS,
  type AppCommandNavigation,
  appCommandNavigation,
} from './app-command-targets.ts';

/**
 * Where a task's link goes, before it is a route (KICKOFF §6.10): a booking
 * (opened, or moved), a new booking for the person (a copy of the task's visit
 * when it rebooks), the lead drawer, a patient-file section, a check-in or
 * review on the patient file — a new one, or the one the task points at
 * (`checkInId`, `reviewId`) — an invoice. One vocabulary for the Tasks room's
 * drawer and Today's work queue (Q-T3).
 */
export type TaskTarget =
  | { kind: 'appointment'; appointmentId: string; reschedule?: boolean }
  | { kind: 'newAppointment'; whoId: string; copyOf?: string }
  | { kind: 'lead'; leadId: string }
  | { kind: 'patient'; patientId: string; section: 'timeline' | 'treatments' }
  | {
      kind: 'checkIn';
      patientId: string;
      appointmentId?: string;
      treatmentId?: string;
      checkInId?: string;
    }
  | { kind: 'review'; patientId: string; appointmentId?: string; reviewId?: string }
  | { kind: 'invoice'; invoiceId: string };

/** What a follow-on reads of a task: its link and its person. */
type TaskTargetSource = Pick<TaskRow, 'link' | 'person'>;

/** The person's own record: their patient file, else their open lead. */
function personRecord({ person }: TaskTargetSource): TaskTarget | null {
  if (person?.patientId) {
    return { kind: 'patient', patientId: person.patientId, section: 'timeline' };
  }
  return person?.openLeadId ? { kind: 'lead', leadId: person.openLeadId } : null;
}

/** The record id a task links when it is of `kind`. */
const linkedId = (task: TaskTargetSource, kind: 'appointment' | 'treatment') =>
  task.link?.kind === kind ? task.link.id : null;

/** A new check-in or review on the person's patient file, tied to the task's visit or treatment. */
function feedbackTarget(
  kind: 'checkIn' | 'review',
  task: TaskTargetSource,
): TaskTarget | null {
  const patientId = task.person?.patientId;
  if (!patientId) return null;
  const appointmentId = linkedId(task, 'appointment');
  const treatmentId = linkedId(task, 'treatment');
  return {
    kind,
    patientId,
    ...(appointmentId ? { appointmentId } : {}),
    ...(kind === 'checkIn' && treatmentId ? { treatmentId } : {}),
  };
}

/** A new booking for the task's person — a copy of its visit when it rebooks one. */
function bookingTarget(task: TaskTargetSource, copy: boolean): TaskTarget | null {
  const whoId = task.person?.id;
  if (!whoId) return null;
  const visit = copy ? linkedId(task, 'appointment') : null;
  return visit
    ? { kind: 'newAppointment', whoId, copyOf: visit }
    : { kind: 'newAppointment', whoId };
}

/**
 * Where an outcome's follow-on screen opens (the outcome table's "Then",
 * `tasks.md:185–227`): a new booking for the person (by their contact), a
 * rebooking of the task's visit, a move of it, a new check-in or review on the
 * patient file (research-tasks T5), or the person's own record ("Fix the
 * number", "Call now"). None where the task lacks what it needs.
 */
export function taskFollowOnTarget(
  form: TaskFollowOnForm,
  task: TaskTargetSource,
): TaskTarget | null {
  switch (form) {
    case 'appointmentNew':
      return bookingTarget(task, false);
    case 'appointmentRebook':
      return bookingTarget(task, true);
    case 'appointmentMove': {
      const visit = linkedId(task, 'appointment');
      return visit
        ? { kind: 'appointment', appointmentId: visit, reschedule: true }
        : null;
    }
    case 'reviewLog':
      return feedbackTarget('review', task);
    case 'visitCheckIn':
    case 'aftercareCheckIn':
      return feedbackTarget('checkIn', task);
    case 'patientFile':
    case 'personRecord':
      return personRecord(task);
  }
}

/** A check-in or review drawer's prefill. */
function feedbackSearch(target: {
  appointmentId?: string;
  treatmentId?: string;
}): Record<string, string> {
  return {
    ...(target.appointmentId ? { appointment: target.appointmentId } : {}),
    ...(target.treatmentId ? { treatment: target.treatmentId } : {}),
  };
}

/**
 * The navigation a target is, with `referrer` — the room path the booking and
 * invoice drawers keep behind them (`from`, KICKOFF §4: "tasks", "today") —
 * and a patient-file section by its own route.
 */
export function taskTargetNavigation(
  target: TaskTarget,
  organizationSlug: string,
  referrer: string,
): AppCommandNavigation {
  switch (target.kind) {
    case 'appointment':
      return {
        ...organizationAppointment(organizationSlug, target.appointmentId),
        search: { from: referrer, ...(target.reschedule ? { mode: 'reschedule' } : {}) },
      };
    case 'newAppointment':
      return {
        ...organizationAppointmentCreate(organizationSlug),
        search: {
          who: target.whoId,
          source: 'task',
          from: referrer,
          ...(target.copyOf ? { copyOf: target.copyOf } : {}),
        },
      };
    case 'lead':
      return { ...organizationLead(organizationSlug, target.leadId) };
    case 'patient':
      return {
        to: `${APP_COMMAND_TARGETS.patient}/${target.section}`,
        params: { organizationSlug, patientId: target.patientId },
      };
    case 'checkIn':
      if (target.checkInId) {
        return organizationCheckInEdit(
          organizationSlug,
          target.patientId,
          target.checkInId,
        );
      }
      return {
        ...organizationCheckInCreate(organizationSlug, target.patientId),
        search: feedbackSearch(target),
      };
    case 'review':
      if (target.reviewId) {
        return organizationReviewEdit(
          organizationSlug,
          target.patientId,
          target.reviewId,
        );
      }
      return {
        ...organizationReviewCreate(organizationSlug, target.patientId),
        search: feedbackSearch(target),
      };
    case 'invoice':
      return appCommandNavigation('invoice', {
        organizationSlug,
        recordId: target.invoiceId,
        referrer,
      });
  }
}
