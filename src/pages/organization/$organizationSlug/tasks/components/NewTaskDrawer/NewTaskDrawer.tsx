import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  TASK_REMIND_MINUTES,
  type TaskChange,
} from '@/shared/api/clinic/tasks-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useLead, useLeadViewer } from '@/shared/hooks/useLeads/index.ts';
import { useNow } from '@/shared/hooks/useNow/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';
import { useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useTaskDueAtWords } from '../../hooks/useTaskDueLabel/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { staffName } from '../../tasks.display.ts';
import type { TaskCreateSearch } from '../../tasks.search.ts';
import {
  type NewTaskForm,
  newTaskForm,
  newTaskInputOf,
  newTaskOwnerId,
  type NewTaskPerson,
  personFirstName,
} from './new-task-form.ts';
import {
  personOfLead,
  personOfPatient,
  usePersonRecordLabel,
} from './new-task-person.ts';
import {
  NewTaskHowFields,
  NewTaskWhatFields,
  NewTaskWhenFields,
} from './NewTaskDrawerFields.tsx';
import { useNewTaskSave } from './use-new-task-save.ts';

const K = TASKS_KEYS.newTask;

/** The drawer's steps, in order. */
type NewTaskStepId = 'what' | 'when' | 'how';

/** Which step holds each field — the server's refusal opens it. */
const FIELD_STEPS: Readonly<Record<keyof NewTaskForm, NewTaskStepId>> = {
  person: 'what',
  type: 'what',
  title: 'what',
  duePreset: 'when',
  dueDate: 'when',
  dueTime: 'when',
  ownerId: 'when',
  priority: 'how',
  remind: 'how',
  notes: 'how',
};

/** What New task hands the room once the task exists (D28: the list stays). */
export interface NewTaskCreated {
  change: TaskChange;
  /** The assignee's short name ("Riya S."). */
  owner: string;
  /** The due as its chip reads ("Tomorrow 11 am"), else the picked day and time in words. */
  due: string;
}

/** Props of {@link NewTaskDrawer}. */
export interface NewTaskDrawerProps {
  /** `?lead=` / `?patient=` — whom the task is for, when opened from them. */
  prefill: TaskCreateSearch;
  /** ×, Cancel, the backdrop, Esc — asking first once something was entered. */
  onClose: () => void;
  onCreated: (created: NewTaskCreated) => void;
}

/** The lead or patient the URL names, once read. */
function usePrefilledPerson(prefill: TaskCreateSearch): NewTaskPerson | null {
  const patient = usePatient(prefill.patient);
  const lead = useLead(prefill.patient ? undefined : prefill.lead);
  if (patient.data) return personOfPatient(patient.data);
  if (lead.data) return personOfLead(lead.data);
  return null;
}

/** The team picker's rows: every active member, the signed-in one first as "You". */
function useOwnerOptions(viewerId: string | null): PickerOption<StaffProfile>[] {
  const { t } = useTranslation([TASKS_NS, CLINIC_NS]);
  const staff = useStaffProfiles();
  const people = (staff.data ?? []).filter((profile) => profile.active);
  const ordered = [
    ...people.filter((profile) => profile.id === viewerId),
    ...people.filter((profile) => profile.id !== viewerId),
  ];
  return ordered.map((profile) => ({
    key: profile.id,
    label: staffName(profile),
    sub: profile.roles
      .map((role) => t(CLINIC_KEYS.roles[role], { ns: CLINIC_NS }))
      .join(' · '),
    meta: profile.id === viewerId ? t(K.owner.you, { ns: TASKS_NS }) : undefined,
    tone: profile.tone,
    leading: { kind: 'avatar', initials: profile.initials },
    keywords: [profile.initials],
    data: profile,
  }));
}

/** The form's values as they stand, every key present (the form starts with all of them). */
function useFormValues(form: UseFormReturn<NewTaskForm>): NewTaskForm {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as NewTaskForm;
}

/** The words the step heads, the footer and the toast read. */
interface NewTaskWords {
  typeLabel: string;
  /** The assignee's short name ("Riya S."). */
  owner: string;
  due: string;
  /** What an empty Title saves as ("Call back · Priti", H:6072). */
  fallbackTitle: string;
}

function useNewTaskWords({
  values,
  person,
  ownerId,
  ownerOptions,
  viewer,
  now,
}: {
  values: NewTaskForm;
  person: NewTaskPerson | null;
  ownerId: string | null;
  ownerOptions: PickerOption<StaffProfile>[];
  viewer: StaffProfile | null;
  now: Date;
}): NewTaskWords {
  const { t } = useTranslation(TASKS_NS);
  const dueAtWords = useTaskDueAtWords();
  const owner =
    ownerOptions.find((option) => option.key === ownerId)?.data ??
    (viewer?.id === ownerId ? viewer : undefined);
  const typeLabel = t(K.type[values.type]);
  return {
    typeLabel,
    owner: owner ? shortPersonName(staffName(owner)) : '',
    due: values.duePreset
      ? t(K.due[values.duePreset])
      : dueAtWords(values.dueDate, values.dueTime, now),
    fallbackTitle: person
      ? t(K.titleField.fallback, { type: typeLabel, first: personFirstName(person) })
      : typeLabel,
  };
}

/** The steps' heads (H:4135 `accVM('tk', …)`): what each lacks, and a collapsed one's sum (H:4483). */
function useStepHeads({
  values,
  person,
  ownerId,
  openStep,
  words,
}: {
  values: NewTaskForm;
  person: NewTaskPerson | null;
  ownerId: string | null;
  openStep: string;
  words: NewTaskWords;
}): Record<NewTaskStepId, Omit<DrawerStep, 'id' | 'content'>> {
  const { t } = useTranslation(TASKS_NS);
  const sum = (stepId: NewTaskStepId, parts: readonly (string | null | undefined)[]) =>
    openStep === stepId ? undefined : parts.filter(Boolean).join(' · ');
  return {
    what: {
      title: t(K.steps.what),
      missing: person ? [] : [t(K.forField.label)],
      complete: Boolean(person && values.title.trim()),
      summary: sum('what', [person?.name, values.title.trim() || words.typeLabel]),
    },
    when: {
      title: t(K.steps.when),
      missing: ownerId ? [] : [t(K.owner.label)],
      summary: sum('when', [words.due, words.owner]),
    },
    how: {
      title: t(K.steps.how),
      summary: sum('how', [
        t(K.priority[values.priority]),
        values.remind ? t(K.remind, { minutes: TASK_REMIND_MINUTES }) : null,
      ]),
    },
  };
}

/**
 * New task (KICKOFF §6.10 New task, Q-T4; the design's unreachable 720px
 * drawer, H:1869–1882, H:6052–6074) on the shared record drawer: "New task"
 * over "For <person> · shows in Tasks and on this person’s timeline", and
 * three steps — "What needs doing" (For: the Picker over patients and leads,
 * prefilled by `?lead=` / `?patient=`; Type; Title), "When & who" (Due chips,
 * the date and "Due time"; "Assign to", the team picker — the lead's owner,
 * else the member) and "How & notes" (Normal · High, "Remind 15 min before",
 * Notes). The footer reads "↔ <record>" with "Add task". An empty title saves
 * as "<type> · <first name>". Exits ask before discarding what was entered.
 * Mounted per opening — the room renders it for `/tasks/create` alone.
 */
export function NewTaskDrawer({ prefill, onClose, onCreated }: NewTaskDrawerProps) {
  const { t } = useTranslation(TASKS_NS);
  const now = useNow();
  const idPrefix = `new-task-${useId().replace(/:/g, '')}`;
  const form = useForm<NewTaskForm>({ defaultValues: newTaskForm(clinicToday()) });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('what');
  const prefilled = usePrefilledPerson(prefill);
  const viewer = useLeadViewer().data ?? null;
  const ownerOptions = useOwnerOptions(viewer?.id ?? null);
  const recordLabel = usePersonRecordLabel();

  // The URL's person arrives after the drawer opens; it holds until another is picked.
  const person = values.person ?? prefilled;
  const ownerId = newTaskOwnerId({ ...values, person }, viewer?.id ?? null);
  const words = useNewTaskWords({ values, person, ownerId, ownerOptions, viewer, now });
  const heads = useStepHeads({ values, person, ownerId, openStep, words });
  const { saveState, save } = useNewTaskSave({
    form,
    input: () =>
      newTaskInputOf(
        { ...form.getValues(), person },
        { ownerId, fallbackTitle: words.fallbackTitle },
      ),
    onField: (field) => setOpenStep(FIELD_STEPS[field]),
    onDone: (change) => onCreated({ change, owner: words.owner, due: words.due }),
  });

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
          ownerId={ownerId}
          ownerOptions={ownerOptions}
          today={clinicToday(now)}
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
      sub={person ? t(K.sub, { person: person.name }) : t(K.subNoPerson)}
      width={720}
      // The open step's circle in the near-black ink, as the composer's (H:4483, z900).
      tone="stone"
      steps={steps}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      onMissing={(stepId) =>
        notify.warning(t(stepId === 'what' ? K.forField.missing : K.owner.missing))
      }
      summary={person ? t(K.footer, { person: recordLabel(person) }) : undefined}
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={TASKS_TEST_IDS.newTask.drawer}
    />
  );
}
