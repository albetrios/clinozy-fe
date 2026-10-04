import { useTranslation } from 'react-i18next';

import { searchLeadContacts } from '@/shared/api/clinic/leads-api.ts';
import type { ListPage } from '@/shared/api/fetch-list-page.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import type { NewTaskPerson } from './new-task-form.ts';
import { personOfHit, usePersonRecordLabel } from './new-task-person.ts';

/** Props for {@link NewTaskPersonField}. */
export interface NewTaskPersonFieldProps {
  value: NewTaskPerson | null;
  onChange: (person: NewTaskPerson | null) => void;
  id?: string;
  invalid?: boolean;
  testId: string;
}

/**
 * New task's "For" (KICKOFF §6.10 New task, Q-T4): the shared Picker over
 * patients and leads, searched by name, mobile or number — the contact search
 * New lead reads (`searchLeadContacts`). A hit shows its avatar (sage with the
 * "P" for a patient, lav otherwise), its record and its mobile.
 */
export function NewTaskPersonField({
  value,
  onChange,
  id,
  invalid,
  testId,
}: NewTaskPersonFieldProps) {
  const { t } = useTranslation(TASKS_NS);
  const recordLabel = usePersonRecordLabel();

  const optionOf = (
    person: NewTaskPerson,
    phone?: string,
  ): PickerOption<NewTaskPerson> => ({
    key: `${person.kind}:${person.id}`,
    label: person.name,
    sub: [recordLabel(person), phone ? formatClinicPhone(phone) : null]
      .filter((part) => part && part !== person.name)
      .join(' · '),
    tone: person.kind === 'patient' ? 'sage' : 'lav',
    leading: {
      kind: 'avatar',
      initials: personInitials(person.name),
      patient: person.kind === 'patient',
    },
    data: person,
  });

  const load = async (query: string): Promise<ListPage<PickerOption<NewTaskPerson>>> => {
    const hits = await searchLeadContacts(query);
    return {
      rows: hits.map((hit) => optionOf(personOfHit(hit), hit.phone)),
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
      loadOptionsKey={['tasks', 'new-task', 'people']}
      selectedOptions={selected ? [selected] : []}
      value={selected?.key ?? null}
      onChange={(_key, option) => onChange(option?.data ?? null)}
      invalid={invalid}
      testId={testId}
    />
  );
}
