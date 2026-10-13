/**
 * How the Tasks room names people and records (KICKOFF §6.10): pure, shared by
 * the rows, New task, the task drawer and "What’s next".
 */
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { TaskPerson, TaskRow } from '@/shared/api/app/tasks-contracts.ts';
import type { ContactCardData } from '@/shared/components/PersonCard/index.ts';

/** What a task's person is to the clinic: a patient, a lead, or a chat-only contact. */
export function taskPersonKind(
  person: Pick<TaskPerson, 'patientId' | 'openLeadId'>,
): ContactCardData['kind'] {
  if (person.patientId) return 'patient';
  return person.openLeadId ? 'lead' : 'contact';
}

/**
 * A task's person as their contact card reads them (D32 — a patient, a lead or a contact): a
 * patient by their number ("#3508"), anyone else by their contact number ("C-1188"); null for a
 * task about nobody.
 */
export function taskContactCard(row: Pick<TaskRow, 'person'>): ContactCardData | null {
  const { person } = row;
  if (!person) return null;
  let id: string | null = null;
  if (person.patientNumber !== null) id = displayId.patient(person.patientNumber);
  else if (person.contactNumber !== null) id = displayId.contact(person.contactNumber);
  return {
    kind: taskPersonKind(person),
    name: person.name,
    displayId: id,
    reach: person.phone ? [{ channel: 'whatsapp', phone: person.phone }] : [],
  };
}

/** Two capitals or more lead an acronym ("LHR", "PRP"), which keeps its case. */
const ACRONYM = /^\p{Lu}{2}/u;

/**
 * A phrase continuing a sentence after a " · " — "Created by Clinozy · a lead
 * wrote…", "Next task set · Call again · tomorrow 11 am": its first letter in
 * lower case, unless it starts an acronym. A script without case is left as
 * it is.
 */
export function lowerFirst(text: string, locale?: string): string {
  if (!text || ACRONYM.test(text)) return text;
  const [first = '', ...rest] = Array.from(text);
  return first.toLocaleLowerCase(locale) + rest.join('');
}
