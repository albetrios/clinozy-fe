import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import type { ContactCardData } from '@/shared/components/PersonCard/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import { taskPersonKind } from '../../tasks.display.ts';

/**
 * The person a New task is for — a contact (`con_…`), what the task points at — as a patient,
 * a lead or a contact.
 */
export interface NewTaskPerson {
  contactId: string;
  name: string;
  /** "Follow up · <first name>" when the Title is left empty. */
  firstName: string;
  kind: ContactCardData['kind'];
  /** Their primary number, E.164. */
  phone: string | null;
  /** Their open lead — its owner is the task's default assignee (H:6056). */
  openLeadId: string | null;
  /** That lead's owner, when it was read with the person (`?lead=`); `undefined` until read. */
  leadOwnerId?: string | null;
  /**
   * The lead the task points at (`lead_id`): the one New task was opened from, else a lead's own
   * open lead — never a patient's, whose task a reassign would otherwise move the lead with
   * (D81 TASKS-M3). The task takes the lead's branch.
   */
  leadId: string | null;
}

/** The first word of a name — a first name when the record has none apart. */
const firstWordOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The person a contact-search hit — or the `?contact=` read — names. */
export function personOfContact(
  contact: Pick<
    ContactSummary,
    'id' | 'name' | 'firstName' | 'primaryPhone' | 'patientId' | 'openLeadId'
  >,
): NewTaskPerson {
  const kind = taskPersonKind(contact);
  return {
    contactId: contact.id,
    name: contact.name,
    firstName: contact.firstName || firstWordOf(contact.name),
    kind,
    phone: contact.primaryPhone || null,
    openLeadId: contact.openLeadId,
    leadId: kind === 'lead' ? contact.openLeadId : null,
  };
}

/** The person `?lead=` names — the task points at that lead, whatever its status. */
export function personOfLead(
  lead: Pick<
    LeadRecord,
    'id' | 'contactId' | 'name' | 'person' | 'phone' | 'patientId' | 'ownerId'
  >,
): NewTaskPerson {
  return {
    contactId: lead.contactId,
    name: lead.name,
    firstName: lead.person?.firstName ?? firstWordOf(lead.name),
    kind: lead.patientId ? 'patient' : 'lead',
    phone: lead.phone,
    openLeadId: lead.id,
    leadOwnerId: lead.ownerId,
    leadId: lead.id,
  };
}

/** "Patient", "Lead", "Contact" — what the person is to the clinic. */
export function usePersonKindLabel(): (person: Pick<NewTaskPerson, 'kind'>) => string {
  const { t } = useTranslation(TASKS_NS);
  return useCallback(
    (person: Pick<NewTaskPerson, 'kind'>) => t(TASKS_KEYS.sources[person.kind]),
    [t],
  );
}
