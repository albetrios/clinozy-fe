import { useId, useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type { TaskRecord } from '@/shared/api/app/tasks-contracts.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useContact } from '@/shared/hooks/useContacts/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useLead } from '@/shared/hooks/useLeads/index.ts';
import { useTaskDueAtWords } from '@/shared/hooks/useTaskDueLabel/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import type { TaskCreateSearch } from '../../tasks.dialog-search.ts';
import { newTaskFieldsOf, type NewTaskForm, newTaskForm } from './new-task-form.ts';
import {
  type NewTaskPerson,
  personOfContact,
  personOfLead,
  usePersonKindLabel,
} from './new-task-person.ts';
import {
  NewTaskHowFields,
  NewTaskWhatFields,
  NewTaskWhenFields,
} from './NewTaskDrawerFields.tsx';
import { useNewTaskOwner } from './use-new-task-owner.ts';
import { useNewTaskSave } from './use-new-task-save.ts';

const K = TASKS_KEYS.newTask;

/** The drawer's steps, in order. */
type NewTaskStepId = 'what' | 'when' | 'how';

/** Which step holds each field — the server's refusal opens it. */
const FIELD_STEPS: Readonly<Record<keyof NewTaskForm, NewTaskStepId>> = {
  person: 'what',
  title: 'what',
  duePreset: 'when',
  dueDate: 'when',
  dueTime: 'when',
  owner: 'when',
  priority: 'how',
  notes: 'how',
};

/** What New task hands the room once the task exists (D28: the list stays). */
export interface NewTaskCreated {
  task: TaskRecord;
  /** The assignee's short name ("Riya S.") or queue ("Front desk"). */
  owner: string;
  /** The due as its chip reads ("Tomorrow 11 am"), else the picked day and time in words. */
  due: string;
}

/** Props of {@link NewTaskDrawer}. */
export interface NewTaskDrawerProps {
  /** `?lead=` / `?contact=` — whom the task is for, when opened from them. */
  prefill: TaskCreateSearch;
  /** ×, Cancel, the backdrop, Esc — asking first once something was entered. */
  onClose: () => void;
  onCreated: (created: NewTaskCreated) => void;
}

/**
 * The person the URL names, once read: `?lead=` (`GET /app/leads/:id`, `lead:read`) — the task
 * points at that lead — else `?contact=` (`GET /app/contacts/:id`). A link the member may not
 * read, or a record gone, leaves "For" empty.
 */
function usePrefilledPerson(prefill: TaskCreateSearch): NewTaskPerson | null {
  const access = useAppAccess();
  const canReadLeads = access.isResolved && access.canCode('lead:read');
  const lead = useLead(canReadLeads ? prefill.lead : undefined);
  const contact = useContact(prefill.lead ? undefined : prefill.contact);
  if (prefill.lead) return lead.data ? personOfLead(lead.data) : null;
  return contact.data ? personOfContact(contact.data) : null;
}

/** The words the step heads, the footer and the toast read. */
interface NewTaskWords {
  /** The assignee's short name ("Riya S.") or queue ("Front desk"). */
  owner: string;
  due: string;
  /** What an empty Title saves as ("Follow up · Priti", H:6072) — nothing without a person. */
  fallbackTitle: string;
}

function useNewTaskWords({
  values,
  person,
  ownerName,
  openedAt,
}: {
  values: NewTaskForm;
  person: NewTaskPerson | null;
  ownerName: string;
  openedAt: Date;
}): NewTaskWords {
  const { t } = useTranslation(TASKS_NS);
  const dueAtWords = useTaskDueAtWords();
  return {
    owner: ownerName,
    due: values.duePreset
      ? t(K.due[values.duePreset])
      : dueAtWords(values.dueDate, values.dueTime, openedAt),
    fallbackTitle: person ? t(K.titleField.fallback, { first: person.firstName }) : '',
  };
}

/**
 * The steps' heads (H:4135 `accVM('tk', …)`): what each lacks, and what a collapsed one
 * summarises — the values Save would send (the title falls back to "Follow up · <first name>").
 */
function useStepHeads({
  values,
  person,
  owner,
  words,
}: {
  values: NewTaskForm;
  person: NewTaskPerson | null;
  owner: string | null;
  words: NewTaskWords;
}): Record<NewTaskStepId, Omit<DrawerStep, 'id' | 'content'>> {
  const { t } = useTranslation(TASKS_NS);
  const title = values.title.trim();
  // A title, or a person to name it after ("Follow up · <first name>").
  const named = person !== null || title !== '';
  return {
    what: {
      title: t(K.steps.what),
      missing: named ? [] : [t(K.titleField.label)],
      peek: [
        { kind: 'value', label: t(K.forField.label), value: person?.name },
        {
          kind: 'value',
          label: t(K.titleField.label),
          value: title || words.fallbackTitle,
        },
      ],
    },
    when: {
      title: t(K.steps.when),
      missing: owner ? [] : [t(K.owner.label)],
      peek: [
        { kind: 'value', label: t(K.due.label), value: words.due },
        {
          kind: 'value',
          label: t(K.owner.label),
          value: owner ? words.owner : undefined,
        },
      ],
    },
    how: {
      title: t(K.steps.how),
      peek: [
        {
          kind: 'value',
          label: t(K.priority.label),
          value: t(K.priority[values.priority]),
          tone: values.priority === 'high' ? 'blush' : undefined,
        },
        { kind: 'value', label: t(K.notes.label), value: values.notes.trim() },
      ],
    },
  };
}

/**
 * New task (KICKOFF §6.10 New task, Q-T4; the design's unreachable 720px drawer, H:1869–1882,
 * H:6052–6074) on clinozy-be (`POST /app/tasks`, `task:create`), on the shared record drawer:
 * "New task" over "For <person> · shows in Tasks and on this person’s timeline", and three steps —
 * "What needs doing" (For: the person search, prefilled by `?lead=` / `?contact=`, optional; Title,
 * required without a person), "When & who" (Due chips, the date and "Due time"; "Assign to": the
 * team who can work tasks, then the role queues — the person's lead's owner by default, else the
 * member) and "How & notes" (Normal · High, Notes). The footer reads "↔ <person> · <kind>" with
 * "Add task". An empty title saves as "Follow up · <first name>". The task points at the person
 * and, for a lead, at their lead. The day the chips count from is read once, when the drawer
 * opens, so a retry sends the same body. Exits ask before discarding what was entered. Mounted
 * per opening — the room renders it for `/tasks/create` alone.
 */
export function NewTaskDrawer({ prefill, onClose, onCreated }: NewTaskDrawerProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const [openedAt] = useState(() => new Date());
  const today = appToday(openedAt);
  const idPrefix = `new-task-${useId().replace(/:/g, '')}`;
  const form = useForm<NewTaskForm>({ defaultValues: newTaskForm(today) });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('what');
  const access = useAppAccess();
  const prefilled = usePrefilledPerson(prefill);
  const kindLabel = usePersonKindLabel();

  // The URL's person arrives after the drawer opens; it holds until another is picked or cleared.
  const person = values.person === undefined ? prefilled : values.person;
  const ownerPicker = useNewTaskOwner(person);
  const owner = values.owner ?? ownerPicker.defaultKey;
  const words = useNewTaskWords({
    values,
    person,
    ownerName: ownerPicker.nameOf(owner),
    openedAt,
  });
  const heads = useStepHeads({ values, person, owner, words });
  const { saveState, save } = useNewTaskSave({
    form,
    fields: () =>
      newTaskFieldsOf(form.getValues(), {
        person,
        owner,
        fallbackTitle: words.fallbackTitle,
      }),
    onField: (field) => setOpenStep(FIELD_STEPS[field]),
    onDone: (task) => onCreated({ task, owner: words.owner, due: words.due }),
  });

  // Only a member with `task:create` writes (a View-as preview holds no code); the list offers
  // New task to no one else.
  const onSave = () => {
    if (access.isResolved && !access.canCode('task:create')) {
      notify.info(tErrors(ERRORS_KEYS.api.http403));
      return;
    }
    void save();
  };

  const fields = { form, values, idPrefix };
  const steps: DrawerStep[] = [
    {
      id: 'what',
      ...heads.what,
      content: <NewTaskWhatFields {...fields} person={person} />,
    },
    {
      id: 'when',
      ...heads.when,
      content: (
        <NewTaskWhenFields
          {...fields}
          owner={owner}
          ownerOptions={ownerPicker.options}
          today={today}
        />
      ),
    },
    { id: 'how', ...heads.how, content: <NewTaskHowFields {...fields} /> },
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.title)}
      sub={person ? t(K.sub, { person: isolateText(person.name) }) : t(K.subNoPerson)}
      width={720}
      // The open step's circle in the near-black ink, as the composer's (H:4483, z900).
      tone="stone"
      steps={steps}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      onMissing={(stepId) =>
        notify.warning(t(stepId === 'what' ? K.titleField.missing : K.owner.missing))
      }
      summary={
        person
          ? t(K.footer, {
              person: `${isolateText(person.name)} · ${kindLabel(person)}`,
            })
          : undefined
      }
      saveLabel={t(K.save)}
      onSave={onSave}
      saveState={saveState}
      dirty={isDirty}
      testId={TASKS_TEST_IDS.newTask.drawer}
    />
  );
}
