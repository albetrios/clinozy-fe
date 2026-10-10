import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type {
  LeadContactHit,
  LeadRecord,
} from '@/shared/api/clinic/leads-fixture-contracts.ts';
import type { PatientRow } from '@/shared/api/clinic/patients-fixture-contracts.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import type { NewTaskPerson } from './new-task-form.ts';

/** The person a contact-search hit names (New task's "For"). */
export function personOfHit(hit: LeadContactHit): NewTaskPerson {
  return {
    kind: hit.kind,
    id: hit.id,
    name: hit.name,
    seq: hit.seq,
    contact: hit.kind === 'lead' && hit.contactThread,
    ownerId: null,
  };
}

/** The person `?patient=` names. */
export function personOfPatient(
  patient: Pick<PatientRow, 'id' | 'firstName' | 'lastName' | 'seq'>,
): NewTaskPerson {
  return {
    kind: 'patient',
    id: patient.id,
    name: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
    seq: patient.seq,
    contact: false,
    ownerId: null,
  };
}

/** The person `?lead=` names — with the lead's owner, the task's default assignee (H:6056). */
export function personOfLead(
  lead: Pick<LeadRecord, 'id' | 'name' | 'seq' | 'ownerId' | 'isContactThread'>,
): NewTaskPerson {
  return {
    kind: 'lead',
    id: lead.id,
    name: lead.name,
    seq: lead.seq,
    contact: lead.isContactThread,
    ownerId: lead.ownerId,
  };
}

/** "Patient #3508", "Lead #2363" — or, for a chat-only contact, just the name. */
export function usePersonRecordLabel(): (person: NewTaskPerson) => string {
  const { t } = useTranslation(TASKS_NS);
  return useCallback(
    (person: NewTaskPerson) => {
      if (person.contact || person.seq === null) return person.name;
      return person.kind === 'patient'
        ? t(TASKS_KEYS.sources.patient, { id: displayId.patient(person.seq) })
        : t(TASKS_KEYS.sources.lead, { id: displayId.lead(person.seq) });
    },
    [t],
  );
}
