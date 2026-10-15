import type { FieldPath, PathValue, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import { TASK_TITLE_MAX, TASK_WHY_MAX } from '@/shared/api/app/tasks-contracts.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import {
  NEW_TASK_DUE_PRESETS,
  NEW_TASK_PRIORITIES,
  type NewTaskForm,
  withDuePreset,
} from './new-task-form.ts';
import type { NewTaskPerson } from './new-task-person.ts';
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

/** "What needs doing": For (optional — a task may be about no one) and Title. */
export function NewTaskWhatFields({
  form,
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
      <DrawerField
        label={t(K.titleField.label)}
        htmlFor={titleField.id}
        required={!person}
        error={titleField.error}
      >
        <DrawerInput
          {...titleField.control}
          {...form.register('title')}
          maxLength={TASK_TITLE_MAX}
          placeholder={t(K.titleField.placeholder)}
          dictation
          data-testid={IDS.title}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * "When & who": the Due chips over the date and "Due time" (a clinic day and time, sent as one
 * instant), then "Assign to" — the team who can work tasks, then the role queues.
 */
export function NewTaskWhenFields({
  form,
  values,
  idPrefix,
  owner,
  ownerOptions,
  today,
}: NewTaskFieldsProps & {
  /** The assignee's key — the one picked, else the default. */
  owner: string | null;
  ownerOptions: PickerOption<DirectoryMember | null>[];
  today: string;
}) {
  const { t } = useTranslation(TASKS_NS);
  const ids = useDrawerFieldIds(form, idPrefix);
  const dueField = ids('dueDate');
  const ownerField = ids('owner');
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
          value={owner}
          onChange={(key) => {
            if (key) setField(form, 'owner', key);
          }}
          searchable
          // Who the member assigns to most opens the list (feat-write-less, D11).
          recentKey="tasks:owner"
          invalid={Boolean(ownerField.error)}
          testId={IDS.owner}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** "How & notes": Normal · High, then the notes (the task's why line). */
export function NewTaskHowFields({ form, values, idPrefix }: NewTaskFieldsProps) {
  const { t } = useTranslation(TASKS_NS);
  const notesField = useDrawerFieldIds(form, idPrefix)('notes');
  return (
    <div className="flex min-w-0 flex-col gap-(--form-gap)">
      <DrawerChips
        label={t(K.priority.label)}
        options={NEW_TASK_PRIORITIES.map((priority) => ({
          value: priority,
          label: t(K.priority[priority]),
        }))}
        value={values.priority}
        onChange={(priority) => {
          if (priority) setField(form, 'priority', priority);
        }}
        testId={IDS.priority}
      />
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
