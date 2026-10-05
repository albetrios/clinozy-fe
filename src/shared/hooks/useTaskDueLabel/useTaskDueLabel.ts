import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicClockTime, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  type TaskDueAt,
  taskDueAt,
  type TaskDueLabel,
  taskDueLabel,
} from '@/shared/api/clinic/task-views.ts';
import type { TaskRow } from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_DUE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

/** What a due label reads of a task. */
export type TaskDueLabelInput = Pick<
  TaskRow,
  'status' | 'dueAt' | 'snoozeLabel' | 'resolvedBy' | 'resolvedAt'
>;

/** A member's close reads "Done · Now" for its first minute, then the time it happened. */
const JUST_NOW_MS = 60_000;

/** A due day and its time as words apart: "Today", "7 Oct"; "3:30 pm". */
export interface TaskDayTimeWords {
  day: string;
  time: string;
}

/**
 * A clinic-local day and time as the due label words them, apart, read at
 * `now` — "Today" · "11:30 am" (the task drawer's Visit tile): the day by the
 * rooms' one time rule, the time in the viewer's hour cycle.
 */
export function useTaskDayTimeWords(): (
  date: string,
  time: string,
  now: Date,
) => TaskDayTimeWords {
  const clock = useClinicClock();
  return useCallback(
    (date: string, time: string, now: Date) => ({
      day: clock.wallDay(date, now),
      time: clock.wallTime(date, time),
    }),
    [clock],
  );
}

/** A due day and time by the rooms' one time rule: "11:30 am" today, "Tomorrow 3:30 pm", "7 Oct 3:30 pm". */
function useDueAtWords(sameDay = false): (label: TaskDueAt, now: Date) => string {
  const clock = useClinicClock();
  return useCallback(
    (label: TaskDueAt, now: Date) =>
      clock.wallMoment(label.date, label.time, { now, sameDay }),
    [clock, sameDay],
  );
}

/**
 * A picked clinic-local day and time in the due label's words, read at `now`
 * ("5:00 pm" today, "7 Oct 3:30 pm") — what New task's toast names.
 */
export function useTaskDueAtWords(): (date: string, time: string, now: Date) => string {
  const atWords = useDueAtWords();
  return useCallback(
    (date: string, time: string, now: Date) => atWords(taskDueAt(date, time), now),
    [atWords],
  );
}

/**
 * A task row's due label in words (KICKOFF §6.10 Due labels; `tasks.md:58,
 * 309`): "40 min overdue", "in 3 h"; later the day and time by the rooms' one
 * time rule — "11:30 pm" tonight, "Tomorrow 3:30 pm", "7 Oct 3:30 pm";
 * "Snoozed · 2 h · no answer", "Done · Now", "Done · 9:00 am" or "Done by
 * Clinozy" — the clinic's days and clock, the day in the viewer's language and
 * the time in their Appearance hour cycle (§7.2). `sameDay` where the rows
 * already sit under today — the Today aside, Tasks' "Due today": today's
 * times bare ("11:30 pm"), other days still named.
 */
export function useTaskDueLabel({ sameDay = false }: { sameDay?: boolean } = {}): (
  task: TaskDueLabelInput,
  now: Date,
) => string {
  const { t } = useTranslation(TASK_RULES_NS);
  const clock = useClinicClock();
  const atWords = useDueAtWords(sameDay);

  const words = useCallback(
    (label: TaskDueLabel, now: Date): string => {
      switch (label.kind) {
        case 'overdue':
          return t(TASK_DUE_KEYS.overdue[label.unit], { count: label.count });
        case 'soon':
          return t(TASK_DUE_KEYS.soon[label.unit], { count: label.count });
        case 'at':
          return atWords(label, now);
        case 'snoozed':
          return label.label
            ? t(TASK_DUE_KEYS.snoozed, { label: label.label })
            : t(TASK_DUE_KEYS.snoozedPlain);
        case 'doneByClinozy':
          return t(TASK_DUE_KEYS.doneByClinozy);
        case 'done': {
          if (!label.at || now.getTime() - Date.parse(label.at) < JUST_NOW_MS) {
            return t(TASK_DUE_KEYS.doneNow);
          }
          const at = new Date(label.at);
          return t(TASK_DUE_KEYS.done, {
            time: clock.wallMoment(clinicToday(at), clinicClockTime(at), {
              now,
              sameDay,
            }),
          });
        }
      }
    },
    [t, clock, atWords, sameDay],
  );

  return useCallback(
    (task: TaskDueLabelInput, now: Date) => words(taskDueLabel(task, now), now),
    [words],
  );
}
