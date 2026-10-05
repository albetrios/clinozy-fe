import type { UseFormReturn } from 'react-hook-form';

import type { CreateTaskInput, TaskChange } from '@/shared/api/clinic/tasks-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateTask } from '@/shared/hooks/useTasks/index.ts';

import type { NewTaskForm } from './new-task-form.ts';

/** The form's fields in the drawer's order — a server error opens the first one it names. */
const NEW_TASK_FIELD_ORDER: readonly (keyof NewTaskForm)[] = [
  'person',
  'type',
  'title',
  'duePreset',
  'dueDate',
  'dueTime',
  'ownerId',
  'priority',
  'remind',
  'notes',
];

/** The contract's names the form spells its own way. */
const SERVER_FIELDS: Readonly<Record<string, keyof NewTaskForm>> = {
  patientId: 'person',
  leadId: 'person',
  dueAt: 'dueDate',
  why: 'notes',
  manualType: 'type',
  remindMinutesBefore: 'remind',
};

/** Options of {@link useNewTaskSave}. */
export interface UseNewTaskSaveOptions {
  form: UseFormReturn<NewTaskForm>;
  /** The create the form asks for as it stands — null while it lacks a person or an assignee. */
  input: () => CreateTaskInput | null;
  /** Open the step that holds a field the server named. */
  onField: (field: keyof NewTaskForm) => void;
  onDone: (change: TaskChange) => void;
}

/**
 * New task's write on the shared drawer save (KICKOFF §6.0 Save): "Saving…"
 * holds every exit until the room has closed the drawer on the new task; a
 * refusal outlines the field the server named and opens its step; a dropped
 * connection keeps the drawer with "Retry save" and the 9s toast. Save itself
 * never runs short of a person or an assignee — the steps' missing fields stop
 * it first (`RecordDrawer`).
 */
export function useNewTaskSave({ form, input, onField, onDone }: UseNewTaskSaveOptions) {
  const create = useCreateTask({ notifyOnError: false });
  return useDrawerSave<NewTaskForm, TaskChange>({
    form,
    fieldOrder: NEW_TASK_FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'new-task-save-failed',
    onField: (field) => onField(field as keyof NewTaskForm),
    write: async () => {
      const request = input();
      if (!request) throw new Error('New task saved without a person or an assignee');
      return create.mutateAsync(request);
    },
    onDone,
  });
}
