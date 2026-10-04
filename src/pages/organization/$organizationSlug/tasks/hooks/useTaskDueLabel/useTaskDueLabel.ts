import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { clinicClockTime, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  type TaskDueAt,
  taskDueAt,
  type TaskDueLabel,
  taskDueLabel,
} from '@/shared/api/clinic/task-views.ts';
import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/** What a due label reads of a task. */
export type TaskDueLabelInput = Pick<
  TaskRow,
  'status' | 'dueAt' | 'snoozeLabel' | 'resolvedBy' | 'resolvedAt'
>;

/** A member's close reads "Done · Now" for its first minute, then the time it happened. */
const JUST_NOW_MS = 60_000;

/** A clinic-local day and clock time as a wall-clock `Date` (formatted in UTC, no zone moves it). */
function wallClock(date: string, time: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/** A clinic-local clock time in the viewer's Appearance hour cycle ("3:30 pm"). */
function useClock(): (date: string, time: string) => string {
  const { formatDate, prefs } = useLocaleFormat();
  return useCallback(
    (date: string, time: string) =>
      formatDate(
        wallClock(date, time),
        {
          ...dateFormatOptions('time', prefs.hourCycle),
          hour: 'numeric',
          second: undefined,
        },
        { wallClock: true },
      ),
    [formatDate, prefs.hourCycle],
  );
}

/** "Today 11:30 am" · "Wed 7 Oct 3:30 pm" — a due day and time in words. */
function useDueAtWords(): (label: TaskDueAt) => string {
  const { t } = useTranslation(TASKS_NS);
  const { t: tPicker } = useTranslation(PICKER_NS);
  const { formatDate } = useLocaleFormat();
  const clock = useClock();
  return useCallback(
    (label: TaskDueAt) => {
      const day =
        label.day === 'date'
          ? formatDate(
              wallClock(label.date, '00:00'),
              { weekday: 'short', day: 'numeric', month: 'short' },
              { wallClock: true },
            )
          : tPicker(PICKER_KEYS.date[label.day]);
      return t(TASKS_KEYS.due.at, { day, time: clock(label.date, label.time) });
    },
    [t, tPicker, formatDate, clock],
  );
}

/**
 * A picked clinic-local day and time in the due label's words, read at `now`
 * ("Today 5:00 pm", "Wed 7 Oct 3:30 pm") — what New task's toast names.
 */
export function useTaskDueAtWords(): (date: string, time: string, now: Date) => string {
  const atWords = useDueAtWords();
  return useCallback(
    (date: string, time: string, now: Date) => atWords(taskDueAt(date, time, now)),
    [atWords],
  );
}

/**
 * A task row's due label in words (KICKOFF §6.10 Due labels; `tasks.md:58,
 * 309`): "40 min overdue", "in 3 h", "Today 11:30 am", "Wed 7 Oct 3:30 pm",
 * "Snoozed · 2 h · no answer", "Done · Now" or "Done by Clinozy" — the clinic's
 * days and clock, the day in the viewer's language and the time in their
 * Appearance hour cycle (§7.2).
 */
export function useTaskDueLabel(): (task: TaskDueLabelInput, now: Date) => string {
  const { t } = useTranslation(TASKS_NS);
  const clock = useClock();
  const atWords = useDueAtWords();

  const words = useCallback(
    (label: TaskDueLabel, now: Date): string => {
      switch (label.kind) {
        case 'overdue':
          return t(TASKS_KEYS.due.overdue[label.unit], { count: label.count });
        case 'soon':
          return t(TASKS_KEYS.due.soon[label.unit], { count: label.count });
        case 'at':
          return atWords(label);
        case 'snoozed':
          return label.label
            ? t(TASKS_KEYS.due.snoozed, { label: label.label })
            : t(TASKS_KEYS.groups.snoozed);
        case 'doneByClinozy':
          return t(TASKS_KEYS.due.doneByClinozy);
        case 'done': {
          if (!label.at || now.getTime() - Date.parse(label.at) < JUST_NOW_MS) {
            return t(TASKS_KEYS.due.doneNow);
          }
          const at = new Date(label.at);
          return t(TASKS_KEYS.due.done, {
            time: clock(clinicToday(at), clinicClockTime(at)),
          });
        }
      }
    },
    [t, clock, atWords],
  );

  return useCallback(
    (task: TaskDueLabelInput, now: Date) => words(taskDueLabel(task, now), now),
    [words],
  );
}
