import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import type { TaskTarget } from '@/shared/clinic/task-targets.ts';

/** The source button's kind: the record it opens. */
export type TaskSourceKind = 'appointment' | 'lead' | 'treatment' | 'patient' | 'invoice';

/**
 * The source button (`tasks.md` › Task drawer › 1): "Open appointment" → the
 * booking · "Open lead" → the lead drawer · a treatment's "Open patient" → the
 * file's Treatments · a patient's → the file (its Timeline) · "Open invoice".
 * None for a chat-only contact, or a record the task names no id for. The
 * outcomes' follow-on screens and every target's navigation are shared with
 * Today (`@/shared/clinic/task-targets.ts`).
 */
export function taskSourceTarget(
  row: Pick<TaskRow, 'source' | 'person'>,
): { kind: TaskSourceKind; target: TaskTarget } | null {
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
