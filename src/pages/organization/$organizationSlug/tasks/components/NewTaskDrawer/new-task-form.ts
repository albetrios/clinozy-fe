import { addCivilDays, clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import type { TaskFields, TaskPriority } from '@/shared/api/clinic/tasks-contracts.ts';

import { taskAssigneeOfKey } from '../../hooks/useTaskAssignees/index.ts';
import type { NewTaskPerson } from './new-task-person.ts';

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
const NEW_TASK_DUE_AT: Readonly<Record<NewTaskDuePreset, { days: number; at: string }>> =
  {
    today: { days: 0, at: '17:00' },
    tomorrow: { days: 1, at: '11:00' },
    inThreeDays: { days: 3, at: '11:00' },
    nextWeek: { days: 7, at: '11:00' },
  };

/** The priority chips, "Normal · High" — the API's `low` has no chip (research-tasks §3). */
export const NEW_TASK_PRIORITIES = [
  'normal',
  'high',
] as const satisfies readonly TaskPriority[];

/** One priority chip. */
type NewTaskPriority = (typeof NEW_TASK_PRIORITIES)[number];

/** The New task form (KICKOFF §6.10 New task). */
export interface NewTaskForm {
  /**
   * Who it is for: `undefined` keeps the person the URL names (`?lead=` / `?contact=`), `null`
   * is nobody — a task may be about no one.
   */
  person: NewTaskPerson | null | undefined;
  title: string;
  /** The Due chip the date and time came from; null once either was picked by hand. */
  duePreset: NewTaskDuePreset | null;
  /** Clinic-local `YYYY-MM-DD`. */
  dueDate: string;
  /** Clinic-local `HH:mm`. */
  dueTime: string;
  /** The picked assignee's key (a member or `role:<role>`); null keeps the default. */
  owner: string | null;
  priority: NewTaskPriority;
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
 * New task as it opens (H:6063): the URL's person, no title, due "Tomorrow 11 am", the default
 * assignee, Normal, no notes.
 */
export function newTaskForm(today: string): NewTaskForm {
  return withDuePreset(
    {
      person: undefined,
      title: '',
      duePreset: null,
      dueDate: today,
      dueTime: '11:00',
      owner: null,
      priority: 'normal',
      notes: '',
    },
    'tomorrow',
    today,
  );
}

/**
 * The default assignee (H:6056): the person's lead's owner when they can work tasks, else the
 * member — null while neither is known, or when neither can work tasks.
 */
export function defaultAssigneeKey({
  leadOwnerId,
  myMembershipId,
  workerIds,
}: {
  leadOwnerId: string | null;
  myMembershipId: string | null | undefined;
  /** The members the picker offers (`task:read` holders). */
  workerIds: ReadonlySet<string>;
}): string | null {
  if (leadOwnerId && workerIds.has(leadOwnerId)) return leadOwnerId;
  if (myMembershipId && workerIds.has(myMembershipId)) return myMembershipId;
  return null;
}

/**
 * The create the form asks for — null without a title (typed, or the person's fallback) or an
 * assignee. An empty Title saves as `fallbackTitle` ("Follow up · Priti", H:6072); the due is
 * the picked clinic day and time, so a retry sends the same body.
 */
export function newTaskFieldsOf(
  form: NewTaskForm,
  {
    person,
    owner,
    fallbackTitle,
  }: { person: NewTaskPerson | null; owner: string | null; fallbackTitle: string },
): TaskFields | null {
  const title = form.title.trim() || fallbackTitle;
  if (!(title && owner)) return null;
  const notes = form.notes.trim();
  return {
    title,
    why: notes || null,
    dueAt: clinicInstant(form.dueDate, form.dueTime),
    assignee: taskAssigneeOfKey(owner),
    priority: form.priority,
    contactId: person?.contactId ?? null,
    link: person?.leadId ? { kind: 'lead', id: person.leadId } : null,
  };
}
