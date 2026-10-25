import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  taskNextOpening,
  type TaskSnoozeOption,
} from '@/shared/api/app/tasks-contracts.ts';
import type { BranchHours } from '@/shared/app/branch-hours.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/app/task-rules.constants.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';

/** When an option is read: the moment, and the hours of the task's branch. */
interface TaskSnoozeMoment {
  now: Date;
  hours: BranchHours;
}

/**
 * A Snooze option's words — the menu's, and the row's "Snoozed · <words>": "1 hour", "3 hours",
 * "Next week", and for "Tomorrow" when it wakes, by the one time rule: the task's branch's next
 * opening ("Tomorrow 10:00 am"; "26 Oct 10:00 am" when Sunday is closed).
 */
export function useTaskSnoozeWords(): (
  option: TaskSnoozeOption,
  moment: TaskSnoozeMoment,
) => string {
  const { t } = useTranslation(TASK_RULES_NS);
  const clock = useAppClock();
  return useCallback(
    (option, { now, hours }) => {
      if (option !== 'tomorrow') return t(TASK_RULE_KEYS.snoozeOptions[option]);
      const opening = taskNextOpening(now, hours);
      return clock.wallMoment(opening.date, opening.time, { now });
    },
    [t, clock],
  );
}
