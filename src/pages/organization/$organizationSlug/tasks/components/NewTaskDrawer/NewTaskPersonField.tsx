import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import {
  CONTACT_QUICK_PICK_KEYS,
  CONTACT_QUICK_PICK_NS,
  ContactQuickPickField,
  useQuickAddContact,
} from '@/shared/components/ContactQuickPick/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import {
  type NewTaskPerson,
  personOfContact,
  usePersonKindLabel,
} from './new-task-person.ts';

/** The person's avatar (H:5984): a patient sage, a lead lav, anyone else butter. */
const PERSON_TONES: Readonly<Record<NewTaskPerson['kind'], Tone>> = {
  patient: 'sage',
  lead: 'lav',
  contact: 'butter',
};

/** Props for {@link NewTaskPersonField}. */
export interface NewTaskPersonFieldProps {
  value: NewTaskPerson | null;
  onChange: (person: NewTaskPerson | null) => void;
  id?: string;
  invalid?: boolean;
  testId: string;
}

/**
 * New task's "For" (KICKOFF §6.10 New task, Q-T4) on the contact picker every drawer shares
 * (change-contact-quick-pick D24, `ContactQuickPickField`): the clinic's people — the five last
 * in touch before anything is typed, then the contact search (3+ letters of a name, 4+ digits of
 * a number, or a whole "C-12345"). A hit shows its avatar (sage with the "P" for a patient, lav
 * for a lead), what they are to the clinic, their contact number and their mobile (as New
 * lead's); ↵ takes the first. Nobody on file: the quick add makes the contact (Name and a
 * 10-digit Mobile, `useQuickAddContact`). Optional — a task may be about no one; × clears it.
 */
export function NewTaskPersonField({
  value,
  onChange,
  id,
  invalid,
  testId,
}: NewTaskPersonFieldProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tPick } = useTranslation(CONTACT_QUICK_PICK_NS);
  const kindLabel = usePersonKindLabel();
  const addContact = useQuickAddContact();
  const K = TASKS_KEYS.newTask.forField;

  return (
    <ContactQuickPickField
      id={id}
      invalid={invalid}
      value={
        value
          ? {
              key: value.contactId,
              name: value.name,
              tone: PERSON_TONES[value.kind],
              patient: value.kind === 'patient',
            }
          : null
      }
      title={t(K.label)}
      placeholder={t(K.placeholder)}
      searchPlaceholder={t(K.search)}
      searchLabel={t(K.label)}
      requirePhone
      describe={(hit) => {
        const person = personOfContact(hit);
        return {
          // Each part isolated: the phone stays whole on a right-to-left page.
          line: isolateJoin([
            person.kind === 'contact' ? '' : kindLabel(person),
            displayId.contact(hit.contactNumber),
            hit.primaryPhone ? formatAppPhone(hit.primaryPhone) : '',
          ]),
          action: tPick(CONTACT_QUICK_PICK_KEYS.use),
          tone: PERSON_TONES[person.kind],
        };
      }}
      onPick={(hit) => onChange(personOfContact(hit))}
      onQuickAdd={async (draft) => onChange(personOfContact(await addContact(draft)))}
      onClear={() => onChange(null)}
      testId={testId}
      testIds={{
        search: `${testId}-search`,
        hit: (hit) => `${testId}-option-${hit.id}`,
        add: `${testId}-create`,
        noMatch: `${testId}-empty`,
      }}
    />
  );
}
