import type { TaskLinkKind, TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import type { TaskTarget } from '@/shared/clinic/task-targets.ts';

/** The source button's kind: the record it opens. */
type TaskSourceKind =
  'appointment' | 'lead' | 'treatment' | 'checkIn' | 'review' | 'patient' | 'invoice';

/** The source button: the record's kind (its words) and where it goes. */
interface TaskSource {
  kind: TaskSourceKind;
  target: TaskTarget;
  /** The read code the record needs — the button is hidden without it. */
  code: string;
}

/** What the source button reads of a task: its link and its person. */
type TaskSourceRow = Pick<TaskRow, 'link' | 'person'>;

/** The person's patient file, at a section. */
const fileAt = (
  patientId: string | null | undefined,
  section: 'timeline' | 'treatments',
  kind: TaskSourceKind,
): TaskSource | null =>
  patientId
    ? { kind, target: { kind: 'patient', patientId, section }, code: 'patient:read' }
    : null;

/** Each link kind's button, from the linked id and the person's patient file. */
const LINKED: Readonly<
  Record<TaskLinkKind, (id: string, patientId: string | null) => TaskSource | null>
> = {
  lead: (leadId) => ({
    kind: 'lead',
    target: { kind: 'lead', leadId },
    code: 'lead:read',
  }),
  appointment: (appointmentId) => ({
    kind: 'appointment',
    target: { kind: 'appointment', appointmentId },
    code: 'appointment:read',
  }),
  treatment: (_id, patientId) => fileAt(patientId, 'treatments', 'treatment'),
  checkIn: (checkInId, patientId) =>
    patientId
      ? {
          kind: 'checkIn',
          target: { kind: 'checkIn', patientId, checkInId },
          code: 'patient:read',
        }
      : null,
  review: (reviewId, patientId) =>
    patientId
      ? {
          kind: 'review',
          target: { kind: 'review', patientId, reviewId },
          code: 'patient:read',
        }
      : null,
  invoice: (invoiceId) => ({
    kind: 'invoice',
    target: { kind: 'invoice', invoiceId },
    code: 'payment:read',
  }),
  // A credit (Payments) and a medical rep (Medical, parked) are named by kind only.
  pendingCredit: () => null,
  medicalRep: () => null,
};

/**
 * The source button (`tasks.md` › Task drawer › 1): "Open appointment" → the
 * booking · "Open lead" → the lead drawer · "Open treatment" → the file's
 * Treatments · "Open check-in" / "Open review" → that record over the file ·
 * "Open invoice" — and for a task that points at nothing, the person's patient
 * file ("Open patient", its Timeline). None for a credit or a medical rep, for
 * a record on a file the person does not have, or for a chat-only contact.
 * The read code each needs comes with it; the follow-on screens and every
 * target's navigation are shared with Today (`@/shared/clinic/task-targets.ts`).
 */
export function taskSourceTarget({ link, person }: TaskSourceRow): TaskSource | null {
  const patientId = person?.patientId ?? null;
  if (link) return LINKED[link.kind](link.id, patientId);
  return fileAt(patientId, 'timeline', 'patient');
}
