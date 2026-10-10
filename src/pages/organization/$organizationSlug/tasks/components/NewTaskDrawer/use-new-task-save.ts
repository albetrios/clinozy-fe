import type { UseFormReturn } from 'react-hook-form';

import type { TaskFields, TaskRecord } from '@/shared/api/clinic/tasks-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateTask } from '@/shared/hooks/useTasks/index.ts';

import type { NewTaskForm } from './new-task-form.ts';

/** The form's fields in the drawer's order — a server error opens the first one it names. */
const NEW_TASK_FIELD_ORDER: readonly (keyof NewTaskForm)[] = [
  'person',
  'title',
  'duePreset',
  'dueDate',
  'dueTime',
  'owner',
  'priority',
  'notes',
];

/**
 * `POST /app/tasks`'s fields (`errors[].field`, camel-cased by the shared mapper) the form
 * spells its own way — `title` and `priority` match.
 */
const SERVER_FIELDS: Readonly<Record<string, keyof NewTaskForm>> = {
  contactId: 'person',
  leadId: 'person',
  dueAt: 'dueDate',
  ownerMembershipId: 'owner',
  ownerRole: 'owner',
  why: 'notes',
};

/** Options of {@link useNewTaskSave}. */
export interface UseNewTaskSaveOptions {
  form: UseFormReturn<NewTaskForm>;
  /** The create the form asks for as it stands — null while it lacks a title or an assignee. */
  fields: () => TaskFields | null;
  /** Open the step that holds a field the server named. */
  onField: (field: keyof NewTaskForm) => void;
  onDone: (task: TaskRecord) => void;
}

/**
 * New task's write (`POST /app/tasks`, `task:create`) on the shared drawer save (KICKOFF §6.0
 * Save): "Saving…" holds every exit until the room has closed the drawer on the new task; a
 * refusal outlines the field the server named (`owner_membership_id` "cannot work tasks", a
 * `lead_id` that is not the person's …) and opens its step; a dropped connection keeps the
 * drawer with "Retry save" and the 9s toast — the same body under the same idempotency key. Save
 * itself never runs short of a title or an assignee — the steps' missing fields stop it first
 * (`RecordDrawer`).
 */
export function useNewTaskSave({ form, fields, onField, onDone }: UseNewTaskSaveOptions) {
  const create = useCreateTask({ notifyOnError: false });
  return useDrawerSave<NewTaskForm, TaskRecord>({
    form,
    fieldOrder: NEW_TASK_FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'new-task-save-failed',
    onField: (field) => onField(field as keyof NewTaskForm),
    write: async () => {
      const request = fields();
      if (!request) throw new Error('New task saved without a title or an assignee');
      return create.mutateAsync({ fields: request });
    },
    onDone,
  });
}
