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
} from '@/shared/clinic/clinic-command-targets.ts';

/**
 * Where a task drawer's link goes, before it is a route (KICKOFF §6.10): a
 * booking (opened, or moved), a new booking for the person (a copy of the
 * task's visit when it rebooks), the lead drawer, a patient-file section, an
 * invoice.
 */
export type TaskDrawerTarget =
  | { kind: 'appointment'; appointmentId: string; reschedule?: boolean }
  | { kind: 'newAppointment'; whoId: string; copyOf?: string }
  | { kind: 'lead'; leadId: string }
  | { kind: 'patient'; patientId: string; section: 'timeline' | 'treatments' }
  | { kind: 'invoice'; invoiceId: string };

/** The source button's kind: the record it opens. */
export type TaskSourceKind = 'appointment' | 'lead' | 'treatment' | 'patient' | 'invoice';

/**
 * The source button (`tasks.md` › Task drawer › 1): "Open appointment" → the
 * booking · "Open lead" → the lead drawer · a treatment's "Open patient" → the
 * file's Treatments · a patient's → the file (its Timeline) · "Open invoice".
 * None for a chat-only contact, or a record the task names no id for.
 */
export function taskSourceTarget(
  row: Pick<TaskRow, 'source' | 'person'>,
): { kind: TaskSourceKind; target: TaskDrawerTarget } | null {
  const { source, person } = row;
  const id = source.id;
  switch (source.kind) {
    case 'appointment':
      return id
        ? { kind: 'appointment', target: { kind: 'appointment', appointmentId: id } }
        : null;
    case 'lead':
      return id ? { kind: 'lead', target: { kind: 'lead', leadId: id } } : null;
    case 'treatment':
      return person.patientId
        ? {
            kind: 'treatment',
            target: {
              kind: 'patient',
              patientId: person.patientId,
              section: 'treatments',
            },
          }
        : null;
    case 'patient': {
      const patientId = id ?? person.patientId;
      return patientId
        ? { kind: 'patient', target: { kind: 'patient', patientId, section: 'timeline' } }
        : null;
    }
    case 'invoice':
      return id ? { kind: 'invoice', target: { kind: 'invoice', invoiceId: id } } : null;
    default:
      return null;
  }
}

/** The person's own record: their patient file, else their lead. */
function personRecord(row: Pick<TaskRow, 'person'>): TaskDrawerTarget | null {
  const { patientId, leadId } = row.person;
  if (patientId) return { kind: 'patient', patientId, section: 'timeline' };
  return leadId ? { kind: 'lead', leadId } : null;
}

/**
 * Where an outcome's follow-on screen opens (the outcome table's "Then",
 * `tasks.md:185–227`). The booking forms open as the Appointments room's
 * routes (`from=tasks`) until the shared stackable form (L-38) opens over the
 * list; "Fix the number" and "Call now" open the person's own record. The
 * check-ins and the review log are stacked forms with no route (S:116) — none
 * until their shared units (L-43) land, so "What’s next" alone follows.
 */
export function taskFollowOnTarget(
  form: TaskFollowOnForm,
  row: Pick<TaskRow, 'source' | 'person'>,
): TaskDrawerTarget | null {
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

/** The navigation a target is, with Tasks kept as the room the booking returns to. */
export function taskDrawerNavigation(
  target: TaskDrawerTarget,
  organizationSlug: string,
): ClinicCommandNavigation {
  switch (target.kind) {
    case 'appointment':
      return {
        ...organizationAppointment(organizationSlug, target.appointmentId),
        search: { from: 'tasks', ...(target.reschedule ? { mode: 'reschedule' } : {}) },
      };
    case 'newAppointment':
      return {
        ...organizationAppointmentCreate(organizationSlug),
        search: {
          who: target.whoId,
          source: 'task',
          from: 'tasks',
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
        referrer: 'tasks',
      });
  }
}
