import type { Tone } from './clinic-schema.ts';
import { clinicClockTime, clinicToday } from './clinic-time.ts';
import type { TaskRow, TaskTab } from './tasks-contracts.ts';

/*
 * What the Tasks list derives from its rows (KICKOFF §6.10; `tasks.md:19, 30,
 * 58`): the groups a view shows and each row's due label — one model with
 * Today's aside (Q-T3). Pure, in the clinic's timezone, so they are tested
 * apart from React; the room turns the label into words.
 */

/** One group of the list: To do's three by due time, then Snoozed and Done's one each. */
export type TaskGroupId = 'overdue' | 'today' | 'later' | 'snoozed' | 'done';

/**
 * Each group's square: Overdue blush · Due today butter · Coming up sky
 * (H:4278); Snoozed and Resolved draw none (H:4277).
 */
export const TASK_GROUP_TONES: Readonly<Record<TaskGroupId, Tone | null>> = {
  overdue: 'blush',
  today: 'butter',
  later: 'sky',
  snoozed: null,
  done: null,
};

/** One group: its id and its rows, in order. */
export interface TaskGroup<T> {
  id: TaskGroupId;
  rows: T[];
}

/** What grouping and labelling read of a row. */
type TaskTiming = Pick<
  TaskRow,
  'status' | 'dueAt' | 'snoozeLabel' | 'resolvedBy' | 'resolvedAt'
>;

/** An open task whose due time has passed — its edge and due label turn red. */
export function isTaskOverdue(task: TaskTiming, now: Date): boolean {
  return task.status === 'open' && Date.parse(task.dueAt) < now.getTime();
}

const byDue = <T extends Pick<TaskRow, 'dueAt'>>(a: T, b: T) =>
  Date.parse(a.dueAt) - Date.parse(b.dueAt);

/**
 * A view's groups (`tasks.md:19, 30`; H:4278): To do splits its rows into
 * Overdue (due before now), Due today (later today, clinic-local) and Coming
 * up (a later day), each by due time, an empty one left out — none at all is
 * the To do empty state. Snoozed and Done are one group each, kept even when
 * empty: their empty line renders under the header (§7.3).
 */
export function groupTasks<T extends TaskTiming>(
  rows: readonly T[],
  tab: TaskTab,
  now: Date,
): TaskGroup<T>[] {
  if (tab === 'snoozed') return [{ id: 'snoozed', rows: [...rows] }];
  if (tab === 'done') return [{ id: 'done', rows: [...rows] }];
  const today = clinicToday(now);
  const groups: Record<'overdue' | 'today' | 'later', T[]> = {
    overdue: [],
    today: [],
    later: [],
  };
  for (const row of rows) {
    const due = new Date(row.dueAt);
    if (due.getTime() < now.getTime()) groups.overdue.push(row);
    else if (clinicToday(due) === today) groups.today.push(row);
    else groups.later.push(row);
  }
  return (['overdue', 'today', 'later'] as const)
    .filter((id) => groups[id].length > 0)
    .map((id) => ({ id, rows: [...groups[id]].sort(byDue) }));
}

/** A due label's span unit. */
type TaskDueUnit = 'minutes' | 'hours' | 'days';

/**
 * A row's due label as data (`tasks.md:58, 309`; H:4219): overdue by minutes,
 * hours or days; due within 12 hours ("in 40 min", "in 3 h"); later on a day
 * and a clinic-local clock time; snoozed with the server's label; or done —
 * by Clinozy, or by a member at an instant.
 */
export type TaskDueLabel =
  | { kind: 'overdue'; unit: TaskDueUnit; count: number }
  | { kind: 'soon'; unit: Exclude<TaskDueUnit, 'days'>; count: number }
  | {
      kind: 'at';
      /** The clinic-local day, `YYYY-MM-DD` — worded by the rooms' one time rule. */
      date: string;
      /** The clinic-local clock time, `HH:mm`. */
      time: string;
    }
  | { kind: 'snoozed'; label: string | null }
  | { kind: 'doneByClinozy' }
  | { kind: 'done'; at: string | null };

const MINUTE = 60_000;
/** Up to 12 hours ahead a due time reads "in <n>" (H:4219: `m <= 720`). */
const SOON_MINUTES = 720;

/** "<n> min", "<n> h" or "<n> d" for a span of whole minutes, as the prototype rounds it. */
function spanOf(minutes: number): { unit: TaskDueUnit; count: number } {
  if (minutes < 60) return { unit: 'minutes', count: minutes };
  if (minutes < 1440) return { unit: 'hours', count: Math.round(minutes / 60) };
  return { unit: 'days', count: Math.round(minutes / 1440) };
}

/** A due label on a day at a clock time. */
export type TaskDueAt = Extract<TaskDueLabel, { kind: 'at' }>;

/**
 * A clinic-local day and clock time as a due label — New task's toast names a
 * picked due this way; the words come from the rooms' one time rule
 * (`ClinicClock.wallMoment`).
 */
export function taskDueAt(date: string, time: string): TaskDueAt {
  return { kind: 'at', date, time };
}

/**
 * One row's due label at `now`, in the clinic's timezone (KICKOFF §6.10 Due
 * labels): a done task reads who closed it, a snoozed one its snooze; an open
 * one is overdue, due within 12 hours, or due on a day at a time.
 */
export function taskDueLabel(task: TaskTiming, now: Date): TaskDueLabel {
  if (task.status === 'done') {
    return task.resolvedBy === 'clinozy'
      ? { kind: 'doneByClinozy' }
      : { kind: 'done', at: task.resolvedAt };
  }
  if (task.status === 'snoozed') return { kind: 'snoozed', label: task.snoozeLabel };
  const due = new Date(task.dueAt);
  const minutes = Math.round((due.getTime() - now.getTime()) / MINUTE);
  if (minutes < 0) return { kind: 'overdue', ...spanOf(-minutes) };
  if (minutes <= SOON_MINUTES) {
    const span = spanOf(minutes);
    return {
      kind: 'soon',
      unit: span.unit === 'minutes' ? 'minutes' : 'hours',
      count: span.count,
    };
  }
  return taskDueAt(clinicToday(due), clinicClockTime(due));
}
