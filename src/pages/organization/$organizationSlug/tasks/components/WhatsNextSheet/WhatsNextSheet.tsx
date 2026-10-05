import { useId } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import {
  TASK_FOLLOW_UP_WHEN,
  TASK_WHY_MAX,
  type TaskChange,
  type TaskRow,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
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
  type WhatsNextForm,
  whatsNextInputOf,
  whatsNextMissing,
} from './whats-next-form.ts';

const K = TASKS_KEYS.whatsNext;
const IDS = TASKS_TEST_IDS.whatsNext;

/** Four fields, two of them chip rows: the light 560px (`min(560px, 100vw − 56px)`). */
const CONTENT_PROFILE = { fieldCount: 4 } as const;

/** The form's fields in order — a client check opens the first one it names. */
const FIELD_ORDER: readonly (keyof WhatsNextForm)[] = ['step', 'when', 'ownerId', 'note'];

/** Props of {@link WhatsNextSheet}. */
export interface WhatsNextSheetProps {
  /** The task just closed, as the close answered it. */
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
 * days · Next week), both required, "Assigned to" (the member preselected)
 * and a Note that becomes the why line. "Create task" adds a "Follow-ups you
 * set" task after the closed one and toasts "Next task set · <step> ·
 * <when>"; "Nothing next" closes.
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
  const ownerId = values.ownerId ?? assignees.viewer?.id ?? null;
  const first = task.person.firstName;
  const stepLabel = (step: (typeof WHATS_NEXT_STEPS)[number]) => t(K.step[step]);
  const whenLabel = (when: (typeof TASK_FOLLOW_UP_WHEN)[number]) =>
    tRules(TASK_RULE_KEYS.followUpWhen[when]);
  const closed = t(K.sub, isolateValues({ title: task.title, result }));

  const { saveState, save } = useDrawerSave<WhatsNextForm, TaskChange>({
    form,
    fieldOrder: FIELD_ORDER,
    toastId: 'whats-next-save-failed',
    check: (current) => {
      const [missing] = whatsNextMissing(current);
      if (!missing) return null;
      return {
        fields: [missing],
        message: t(missing === 'step' ? K.pickStep : K.pickWhen),
      };
    },
    onField: () => {},
    write: async () => {
      const current = form.getValues();
      const input = whatsNextInputOf(current, {
        followsTaskId: task.id,
        ownerId,
        title: current.step
          ? t(K.taskTitle, { step: stepLabel(current.step), first })
          : '',
        plannedAfter: t(K.plannedAfter, { after: `${task.title} · ${result}` }),
        now: new Date(),
      });
      if (!input) throw new Error('What’s next saved without a step or a time');
      return create.mutateAsync(input);
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
      title={t(K.title, { first })}
      sub={closed}
      content={CONTENT_PROFILE}
      dismissLabel={t(K.nothingNext)}
      saveLabel={t(K.create)}
      onSave={() => void save()}
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
        <DrawerField label={t(K.note.label)} htmlFor={noteField.id} span="half">
          <DrawerInput
            {...noteField.control}
            {...form.register('note')}
            maxLength={TASK_WHY_MAX}
            placeholder={t(K.note.placeholder)}
            data-testid={IDS.note}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}
