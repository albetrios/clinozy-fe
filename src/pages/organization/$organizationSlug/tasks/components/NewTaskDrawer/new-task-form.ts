import { addCivilDays, clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import {
  type CreateTaskInput,
  type ManualTaskType,
  TASK_REMIND_MINUTES,
  type TaskPriority,
} from '@/shared/api/clinic/tasks-contracts.ts';

/** New task's Due chips, "Today 5 pm · Tomorrow 11 am · In 3 days · Next week" (H:6057). */
export const NEW_TASK_DUE_PRESETS = [
  'today',
  'tomorrow',
  'inThreeDays',
  'nextWeek',
] as const;

/** One Due chip. */
export type NewTaskDuePreset = (typeof NEW_TASK_DUE_PRESETS)[number];

/** What each Due chip sets: days from the clinic's today, at a clinic-local time. */
export const NEW_TASK_DUE_AT: Readonly<
  Record<NewTaskDuePreset, { days: number; at: string }>
> = {
  today: { days: 0, at: '17:00' },
  tomorrow: { days: 1, at: '11:00' },
  inThreeDays: { days: 3, at: '11:00' },
  nextWeek: { days: 7, at: '11:00' },
};

/** The person a New task is for — a patient, or a lead (a chat-only contact too). */
export interface NewTaskPerson {
  kind: 'patient' | 'lead';
  id: string;
  name: string;
  /** Their patient number, else their lead's; null for a chat-only contact. */
  seq: number | null;
  /** A chat-only contact (a lead record that is only a conversation). */
  contact: boolean;
  /** The lead's owner — the default assignee for a lead's task (H:6056). */
  ownerId: string | null;
}

/** The New task form (KICKOFF §6.10 New task). */
export interface NewTaskForm {
  person: NewTaskPerson | null;
  type: ManualTaskType;
  title: string;
  /** The Due chip the date and time came from; null once either was picked by hand. */
  duePreset: NewTaskDuePreset | null;
  /** Clinic-local `YYYY-MM-DD`. */
  dueDate: string;
  /** Clinic-local `HH:mm`. */
  dueTime: string;
  /** Picked assignee; null keeps the default (the lead's owner, else the member). */
  ownerId: string | null;
  priority: TaskPriority;
  remind: boolean;
  notes: string;
}

/** The form with a Due chip's day and time. */
export function withDuePreset(
  form: NewTaskForm,
  preset: NewTaskDuePreset,
  today: string,
): NewTaskForm {
  const { days, at } = NEW_TASK_DUE_AT[preset];
  return { ...form, duePreset: preset, dueDate: addCivilDays(today, days), dueTime: at };
}

/**
 * New task as it opens (H:6063): Call back, no title, due "Tomorrow 11 am",
 * the default assignee, Normal, "Remind 15 min before" on, no notes.
 */
export function newTaskForm(
  today: string,
  person: NewTaskPerson | null = null,
): NewTaskForm {
  return withDuePreset(
    {
      person,
      type: 'call_back',
      title: '',
      duePreset: null,
      dueDate: today,
      dueTime: '11:00',
      ownerId: null,
      priority: 'normal',
      remind: true,
      notes: '',
    },
    'tomorrow',
    today,
  );
}

/** Who the task goes to: the one picked, else the lead's owner, else the member. */
export function newTaskOwnerId(
  form: NewTaskForm,
  viewerId: string | null,
): string | null {
  return form.ownerId ?? form.person?.ownerId ?? viewerId;
}

/**
 * The create the form asks for — null until it has a person and an assignee.
 * An empty Title saves as `fallbackTitle` ("Call back · Priti", H:6072).
 */
export function newTaskInputOf(
  form: NewTaskForm,
  { ownerId, fallbackTitle }: { ownerId: string | null; fallbackTitle: string },
): CreateTaskInput | null {
  const { person } = form;
  if (!(person && ownerId)) return null;
  const notes = form.notes.trim();
  return {
    title: form.title.trim() || fallbackTitle,
    why: notes || null,
    ownerId,
    patientId: person.kind === 'patient' ? person.id : null,
    leadId: person.kind === 'lead' ? person.id : null,
    dueAt: clinicInstant(form.dueDate, form.dueTime),
    rule: 'manual',
    manualType: form.type,
    priority: form.priority,
    remindMinutesBefore: form.remind ? TASK_REMIND_MINUTES : null,
  };
}
