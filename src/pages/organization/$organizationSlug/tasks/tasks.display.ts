/**
 * How the Tasks room names people and records (KICKOFF §6.10): pure, shared by
 * the rows, New task, the task drawer and "What’s next".
 */
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { TaskRow, TaskSourceRef } from '@/shared/api/clinic/tasks-contracts.ts';
import type { ContactCardData } from '@/shared/components/PersonCard/index.ts';

/** A source's display id ("#2363"), or nothing where the contract has no `seq`. */
export function taskSourceId(source: Pick<TaskSourceRef, 'kind' | 'seq'>): string {
  if (source.seq === null) return '';
  return source.kind === 'invoice'
    ? displayId.invoiceNumber(source.seq)
    : displayId.lead(source.seq);
}

/** A task's person as their contact card reads them (D32 — a patient, a lead or a contact). */
export function taskContactCard(row: Pick<TaskRow, 'person'>): ContactCardData {
  const { person } = row;
  let id: string | null = null;
  if (person.seq !== null) {
    id =
      person.kind === 'patient'
        ? displayId.patient(person.seq)
        : displayId.lead(person.seq);
  }
  return {
    kind: person.kind,
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
