import type { FieldPath, PathValue, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  MANUAL_TASK_TYPES,
  TASK_PRIORITIES,
  TASK_REMIND_MINUTES,
  TASK_TITLE_MAX,
  TASK_WHY_MAX,
} from '@/shared/api/clinic/tasks-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerTextarea,
  DrawerToggle,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import {
  NEW_TASK_DUE_PRESETS,
  type NewTaskForm,
  type NewTaskPerson,
  withDuePreset,
} from './new-task-form.ts';
import { NewTaskPersonField } from './NewTaskPersonField.tsx';

const K = TASKS_KEYS.newTask;
const IDS = TASKS_TEST_IDS.newTask;

/** What every step's fields read: the form, its live values and the ids' prefix. */
export interface NewTaskFieldsProps {
  form: UseFormReturn<NewTaskForm>;
  /** The form's values as they stand (`useWatch`). */
  values: NewTaskForm;
  /** Unique per drawer: the controls' DOM ids derive from it. */
  idPrefix: string;
}

/** A field's change, as the member makes it: marked dirty, its error cleared. */
function setField<N extends FieldPath<NewTaskForm>>(
  form: UseFormReturn<NewTaskForm>,
  name: N,
  value: PathValue<NewTaskForm, N>,
) {
  form.setValue(name, value, { shouldDirty: true });
  form.clearErrors(name);
}

/** "What needs doing": For, Type, Title. */
export function NewTaskWhatFields({
  form,
  values,
  idPrefix,
  person,
}: NewTaskFieldsProps & {
  /** Who it is for — the picked person, else the one the URL names. */
  person: NewTaskPerson | null;
}) {
  const { t } = useTranslation(TASKS_NS);
  const ids = useDrawerFieldIds(form, idPrefix);
  const forField = ids('person');
  const titleField = ids('title');
  return (
    <DrawerFieldGrid>
      <DrawerField
        label={t(K.forField.label)}
        htmlFor={forField.id}
        required
        error={forField.error}
      >
        <NewTaskPersonField
          id={forField.id}
          value={person}
          onChange={(next) => setField(form, 'person', next)}
          invalid={Boolean(forField.error)}
          testId={IDS.person}
        />
      </DrawerField>
      <DrawerField label={t(K.type.label)}>
        <DrawerChips
          label={t(K.type.label)}
          options={MANUAL_TASK_TYPES.map((type) => ({
            value: type,
            label: t(K.type[type]),
          }))}
          value={values.type}
          onChange={(type) => {
            if (type) setField(form, 'type', type);
          }}
          testId={IDS.type}
        />
      </DrawerField>
      <DrawerField
        label={t(K.titleField.label)}
        htmlFor={titleField.id}
        error={titleField.error}
      >
        <DrawerInput
          {...titleField.control}
          {...form.register('title')}
          maxLength={TASK_TITLE_MAX}
          placeholder={t(K.titleField.placeholder)}
          data-testid={IDS.title}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** "When & who": the Due chips over the date and "Due time", then "Assign to". */
export function NewTaskWhenFields({
  form,
  values,
  idPrefix,
  ownerId,
  ownerOptions,
  today,
}: NewTaskFieldsProps & {
  /** The assignee — the one picked, else the default. */
  ownerId: string | null;
  ownerOptions: PickerOption<StaffProfile>[];
  today: string;
}) {
  const { t } = useTranslation(TASKS_NS);
  const ids = useDrawerFieldIds(form, idPrefix);
  const dueField = ids('dueDate');
  const ownerField = ids('ownerId');
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.due.label)} error={dueField.error}>
        <div className="flex min-w-0 flex-col gap-2">
          <DrawerChips
            label={t(K.due.label)}
            options={NEW_TASK_DUE_PRESETS.map((preset) => ({
              value: preset,
              label: t(K.due[preset]),
            }))}
            value={values.duePreset}
            onChange={(preset) => {
              if (!preset) return;
              const next = withDuePreset(values, preset, today);
              setField(form, 'duePreset', next.duePreset);
              setField(form, 'dueDate', next.dueDate);
              setField(form, 'dueTime', next.dueTime);
            }}
            testId={IDS.due}
          />
          <div className="flex min-w-0 gap-2">
            <DatePicker
              id={dueField.id}
              value={values.dueDate}
              onChange={(date) => {
                if (!date) return;
                setField(form, 'dueDate', date);
                setField(form, 'duePreset', null);
              }}
              label={t(K.due.date)}
              min={today}
              today={today}
              size="md"
              invalid={Boolean(dueField.error)}
              testId={IDS.dueDate}
              className="min-w-0 flex-1"
            />
            <TimePicker
              value={values.dueTime}
              onChange={(time) => {
                setField(form, 'dueTime', time);
                setField(form, 'duePreset', null);
              }}
              label={t(K.due.time)}
              size="md"
              align="end"
              testId={IDS.dueTime}
              className="w-32 flex-none"
            />
          </div>
        </div>
      </DrawerField>
      <DrawerField
        label={t(K.owner.label)}
        htmlFor={ownerField.id}
        required
        error={ownerField.error}
      >
        <Picker
          id={ownerField.id}
          label={t(K.owner.label)}
          options={ownerOptions}
          value={ownerId}
          onChange={(key) => {
            if (key) setField(form, 'ownerId', key);
          }}
          searchable
          invalid={Boolean(ownerField.error)}
          testId={IDS.owner}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** "How & notes": Normal · High beside "Remind 15 min before", then the notes. */
export function NewTaskHowFields({ form, values, idPrefix }: NewTaskFieldsProps) {
  const { t } = useTranslation(TASKS_NS);
  const notesField = useDrawerFieldIds(form, idPrefix)('notes');
  const remind = t(K.remind, { minutes: TASK_REMIND_MINUTES });
  return (
    <div className="flex min-w-0 flex-col gap-(--form-gap)">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <DrawerChips
          label={t(K.priority.label)}
          options={TASK_PRIORITIES.map((priority) => ({
            value: priority,
            label: t(K.priority[priority]),
          }))}
          value={values.priority}
          onChange={(priority) => {
            if (priority) setField(form, 'priority', priority);
          }}
          testId={IDS.priority}
        />
        <DrawerToggle
          checked={values.remind}
          onCheckedChange={(next) => setField(form, 'remind', next)}
          onLabel={remind}
          offLabel={remind}
          data-testid={IDS.remind}
        />
      </div>
      <DrawerField htmlFor={notesField.id} error={notesField.error}>
        <DrawerTextarea
          {...notesField.control}
          {...form.register('notes')}
          maxLength={TASK_WHY_MAX}
          rows={2}
          placeholder={t(K.notes.placeholder)}
          aria-label={t(K.notes.label)}
          data-testid={IDS.notes}
        />
      </DrawerField>
    </div>
  );
}
