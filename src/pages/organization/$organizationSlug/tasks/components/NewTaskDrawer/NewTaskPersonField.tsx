import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { contactQueryKeys, searchContacts } from '@/shared/api/app/contacts-api.ts';
import type { ListPage } from '@/shared/api/fetch-list-page.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

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
 * New task's "For" (KICKOFF §6.10 New task, Q-T4): the shared Picker over the clinic's people —
 * the contact search (`GET /app/contacts?q=`, `searchContacts`: 3+ letters of a name, 4+ digits
 * of a number, or a whole "C-12345"). A hit shows its avatar (sage with the "P" for a patient,
 * lav for a lead), what they are to the clinic, their contact number and their mobile (as New
 * lead's). Optional — a task may be about no one; × clears it.
 */
export function NewTaskPersonField({
  value,
  onChange,
  id,
  invalid,
  testId,
}: NewTaskPersonFieldProps) {
  const { t } = useTranslation(TASKS_NS);
  const kindLabel = usePersonKindLabel();
  const organizationId = useOrganizationStore((state) => state.organizationId);

  const optionOf = (
    person: NewTaskPerson,
    contactNumber?: number,
  ): PickerOption<NewTaskPerson> => ({
    key: person.contactId,
    label: person.name,
    sub: [
      person.kind === 'contact' ? null : kindLabel(person),
      contactNumber === undefined ? null : displayId.contact(contactNumber),
      person.phone ? formatAppPhone(person.phone) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    tone: PERSON_TONES[person.kind],
    leading: {
      kind: 'avatar',
      initials: personInitials(person.name),
      patient: person.kind === 'patient',
    },
    data: person,
  });

  const load = async (query: string): Promise<ListPage<PickerOption<NewTaskPerson>>> => {
    const hits = await searchContacts(query);
    return {
      rows: hits.map((hit) => optionOf(personOfContact(hit), hit.contactNumber)),
      next: null,
      hasMore: false,
    };
  };

  const selected = value ? optionOf(value) : null;
  return (
    <Picker
      id={id}
      label={t(TASKS_KEYS.newTask.forField.label)}
      placeholder={t(TASKS_KEYS.newTask.forField.placeholder)}
      searchPlaceholder={t(TASKS_KEYS.newTask.forField.search)}
      emptyText={t(TASKS_KEYS.newTask.forField.empty)}
      loadOptions={load}
      loadOptionsKey={[...contactQueryKeys.all, organizationId, 'new-task']}
      selectedOptions={selected ? [selected] : []}
      value={selected?.key ?? null}
      onChange={(_key, option) => onChange(option?.data ?? null)}
      clearable
      invalid={invalid}
      testId={testId}
    />
  );
}
