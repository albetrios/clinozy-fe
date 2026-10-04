import {
  organizationAppointment,
  organizationAppointmentCreate,
  organizationLead,
} from '@/lib/routes/index.ts';
import type { TaskFollowOnForm, TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';

import {
  CLINIC_COMMAND_TARGETS,
  type ClinicCommandNavigation,
  clinicCommandNavigation,
} from './clinic-command-targets.ts';

/**
 * Where a task's link goes, before it is a route (KICKOFF §6.10): a booking
 * (opened, or moved), a new booking for the person (a copy of the task's visit
 * when it rebooks), the lead drawer, a patient-file section, an invoice. One
 * vocabulary for the Tasks room's drawer and Today's work queue (Q-T3).
 */
export type TaskTarget =
  | { kind: 'appointment'; appointmentId: string; reschedule?: boolean }
  | { kind: 'newAppointment'; whoId: string; copyOf?: string }
  | { kind: 'lead'; leadId: string }
  | { kind: 'patient'; patientId: string; section: 'timeline' | 'treatments' }
  | { kind: 'invoice'; invoiceId: string };

/** The person's own record: their patient file, else their lead. */
function personRecord(row: Pick<TaskRow, 'person'>): TaskTarget | null {
  const { patientId, leadId } = row.person;
  if (patientId) return { kind: 'patient', patientId, section: 'timeline' };
  return leadId ? { kind: 'lead', leadId } : null;
}

/**
 * Where an outcome's follow-on screen opens (the outcome table's "Then",
 * `tasks.md:185–227`): a new booking for the person, a rebooking of the task's
 * visit, a move of it, or the person's own record ("Fix the number", "Call
 * now"). The check-ins and the review log are stacked forms with no route
 * (S:116) — none until their shared units (L-43) land.
 */
export function taskFollowOnTarget(
  form: TaskFollowOnForm,
  row: Pick<TaskRow, 'source' | 'person'>,
): TaskTarget | null {
  const who = row.person.patientId ?? row.person.leadId;
  const visit = row.source.kind === 'appointment' ? row.source.id : null;
  switch (form) {
    case 'appointmentNew':
      return who ? { kind: 'newAppointment', whoId: who } : null;
    case 'appointmentRebook':
      if (!who) return null;
      return visit
        ? { kind: 'newAppointment', whoId: who, copyOf: visit }
        : { kind: 'newAppointment', whoId: who };
    case 'appointmentMove':
      return visit
        ? { kind: 'appointment', appointmentId: visit, reschedule: true }
        : null;
    case 'reviewLog':
    case 'visitCheckIn':
    case 'aftercareCheckIn':
      return null;
    case 'patientFile':
    case 'personRecord':
      return personRecord(row);
  }
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
): ClinicCommandNavigation {
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
        to: `${CLINIC_COMMAND_TARGETS.patient}/${target.section}`,
        params: { organizationSlug, patientId: target.patientId },
      };
    case 'invoice':
      return clinicCommandNavigation('invoice', {
        organizationSlug,
        recordId: target.invoiceId,
        referrer,
      });
  }
}
