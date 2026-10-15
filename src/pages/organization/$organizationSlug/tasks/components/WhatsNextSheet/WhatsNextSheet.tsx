import { useId, useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import {
  TASK_FOLLOW_UP_WHEN,
  TASK_WHY_MAX,
  type TaskRecord,
  type TaskRow,
} from '@/shared/api/app/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/app/task-rules.constants.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useCreateTask } from '@/shared/hooks/useTasks/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useTaskAssignees } from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { lowerFirst } from '../../tasks.display.ts';
import {
  emptyWhatsNextForm,
  WHATS_NEXT_STEP_TONES,
  WHATS_NEXT_STEPS,
  whatsNextFieldsOf,
  type WhatsNextForm,
  whatsNextMissing,
  type WhatsNextRequired,
} from './whats-next-form.ts';

const K = TASKS_KEYS.whatsNext;
const IDS = TASKS_TEST_IDS.whatsNext;

/** Four fields, two of them chip rows: the light 560px (`min(560px, 100vw − 56px)`). */
const CONTENT_PROFILE = { fieldCount: 4 } as const;

/** The form's fields in order — a client check or a server refusal opens the first one it names. */
const FIELD_ORDER: readonly (keyof WhatsNextForm)[] = ['step', 'when', 'ownerId', 'note'];

/** The create's fields as the form names them (`POST /app/tasks`). */
const SERVER_FIELDS: Readonly<Record<string, keyof WhatsNextForm>> = {
  title: 'step',
  dueAt: 'when',
  ownerMembershipId: 'ownerId',
  ownerRole: 'ownerId',
  why: 'note',
};

/** The words a missing pick toasts. */
const MISSING_KEYS: Readonly<Record<WhatsNextRequired, string>> = {
  step: K.pickStep,
  when: K.pickWhen,
  ownerId: TASKS_KEYS.newTask.owner.missing,
};

/** Props of {@link WhatsNextSheet}. */
export interface WhatsNextSheetProps {
  /** The task just closed, as the close answered it, with its person. */
  task: TaskRow;
  /** Its result ("Confirmed on call"). */
  result: string;
  /** "Nothing next", ×, the backdrop, Esc — and after "Create task". */
  onClose: () => void;
}

/**
 * "What’s next for <first>?" (KICKOFF §6.10; `tasks.md:86–99, 134–146`;
 * H:4054–4055): over the list 380ms after a closing outcome, on the record
 * drawer at 560px — "Closed · <task> · <result>", one section "Next task":
 * Next step (five toned chips) and When (In 3 hours · Tomorrow 11 am · In 3
 * days · Next week), both required, "Assigned to" (the member preselected —
 * the team who can work tasks) and a Note that becomes the why line. "Create
 * task" adds a task by hand for the same person and record (`POST /app/tasks`,
 * the close's second step — research-tasks Q2) and toasts "Next task set ·
 * <step> · <when>"; a refusal lands on its field; "Nothing next" closes.
 */
export function WhatsNextSheet({ task, result, onClose }: WhatsNextSheetProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const idPrefix = `whats-next-${useId().replace(/:/g, '')}`;
  const form = useForm<WhatsNextForm>({ defaultValues: emptyWhatsNextForm() });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const ids = useDrawerFieldIds(form, idPrefix);
  const assignees = useTaskAssignees();
  const create = useCreateTask({ notifyOnError: false });
  // The due time counts from when the sheet opened, so a "Retry save" sends the same body.
  const [openedAt] = useState(() => new Date());
  const ownerId = values.ownerId ?? assignees.myMembershipId ?? null;
  const first = task.person?.firstName ?? '';
  const stepLabel = (step: (typeof WHATS_NEXT_STEPS)[number]) => t(K.step[step]);
  const whenLabel = (when: (typeof TASK_FOLLOW_UP_WHEN)[number]) =>
    tRules(TASK_RULE_KEYS.followUpWhen[when]);
  const closed = t(K.sub, isolateValues({ title: task.title, result }));
  const titleOf = (step: (typeof WHATS_NEXT_STEPS)[number]) =>
    first ? t(K.taskTitle, { step: stepLabel(step), first }) : stepLabel(step);

  const { saveState, save } = useDrawerSave<WhatsNextForm, TaskRecord>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'whats-next-save-failed',
    check: (current) => {
      const [missing] = whatsNextMissing(current, ownerId);
      return missing ? { fields: [missing], message: t(MISSING_KEYS[missing]) } : null;
    },
    onField: () => {},
    write: async () => {
      const current = form.getValues();
      const fields = whatsNextFieldsOf(current, {
        closed: task,
        ownerId,
        title: current.step ? titleOf(current.step) : '',
        plannedAfter: t(K.plannedAfter, { after: `${task.title} · ${result}` }),
        now: openedAt,
      });
      if (!fields)
        throw new Error('What’s next saved without a step, a time or an owner');
      return create.mutateAsync({ fields });
    },
    onDone: () => {
      const { step, when } = form.getValues();
      if (step && when) {
        notify.success(
          t(K.created, { step: stepLabel(step), when: lowerFirst(whenLabel(when)) }),
        );
      }
      onClose();
    },
  });

  const set = <N extends keyof WhatsNextForm>(name: N, value: WhatsNextForm[N]) => {
    form.setValue(name, value as never, { shouldDirty: true });
    form.clearErrors(name);
  };
  const stepField = ids('step');
  const whenField = ids('when');
  const ownerField = ids('ownerId');
  const noteField = ids('note');

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={first ? t(K.title, { first }) : t(K.titleNoPerson)}
      sub={closed}
      content={CONTENT_PROFILE}
      dismissLabel={t(K.nothingNext)}
      saveLabel={t(K.create)}
      onSave={() => {
        void save();
      }}
      saveState={saveState}
      dirty={isDirty}
      testId={IDS.drawer}
    >
      <DrawerFieldGrid title={t(K.section)}>
        <DrawerField label={t(K.step.label)} required error={stepField.error}>
          <DrawerChips
            label={t(K.step.label)}
            options={WHATS_NEXT_STEPS.map((step) => ({
              value: step,
              label: stepLabel(step),
              tone: WHATS_NEXT_STEP_TONES[step],
            }))}
            value={values.step}
            onChange={(step) => set('step', step)}
            testId={IDS.step}
          />
        </DrawerField>
        <DrawerField label={t(K.when)} required error={whenField.error}>
          <DrawerChips
            label={t(K.when)}
            options={TASK_FOLLOW_UP_WHEN.map((when) => ({
              value: when,
              label: whenLabel(when),
            }))}
            value={values.when}
            onChange={(when) => set('when', when)}
            testId={IDS.when}
          />
        </DrawerField>
        <DrawerField
          label={t(K.owner)}
          htmlFor={ownerField.id}
          error={ownerField.error}
          span="half"
          stretch={false}
        >
          <Picker
            id={ownerField.id}
            label={t(K.owner)}
            options={assignees.options}
            value={ownerId}
            onChange={(key) => {
              if (key) set('ownerId', key);
            }}
            searchable
            testId={IDS.owner}
          />
        </DrawerField>
        <DrawerField
          label={t(K.note.label)}
          htmlFor={noteField.id}
          error={noteField.error}
          span="half"
        >
          <DrawerInput
            {...noteField.control}
            {...form.register('note')}
            maxLength={TASK_WHY_MAX}
            placeholder={t(K.note.placeholder)}
            dictation
            data-testid={IDS.note}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}
