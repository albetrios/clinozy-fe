import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  findTaskOutcome,
  TASK_RULES,
  type TaskChange,
  type TaskDetail,
  type TaskRow,
  type TaskRuleOutcome,
  type TaskSnoozeOption,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import {
  useHandTaskToClinozy,
  useReassignTask,
  useSnoozeTask,
  useTaskOutcome,
  useUndoTaskChange,
} from '@/shared/hooks/useTasks/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  type TaskDrawerTarget,
  taskFollowOnTarget,
} from '../../components/TaskDrawer/task-drawer-targets.ts';
import { taskContextLead } from '../../components/TaskDrawer/use-task-context-tiles.ts';
import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import { lowerFirst, staffName } from '../../tasks.display.ts';
import type { TaskAssignees } from '../useTaskAssignees/index.ts';

/** "What’s next" opens this long after a closing outcome (`tasks.md:180–233`, H:4293). */
export const WHATS_NEXT_DELAY_MS = 380;

/** The task a closing outcome closed, for "What’s next for <first>?". */
export interface WhatsNextFor {
  task: TaskRow;
  result: string;
}

/** Options of {@link useTaskActions}. */
export interface TaskActionsOptions {
  assignees: TaskAssignees;
  /** Close the drawer: back to the list. */
  close: () => void;
  /** Open a follow-on screen or a record (the booking, the lead drawer, the file). */
  openTarget: (target: TaskDrawerTarget) => void;
  /** "What’s next for <first>?" over the list. */
  openWhatsNext: (next: WhatsNextFor) => void;
}

/** What the task drawer does with a task. */
export interface TaskActions {
  /** A write is in flight: the drawer's actions wait (one write at a time). */
  busy: boolean;
  /** Close, snooze or act on the task with one of its rule's outcomes. */
  recordOutcome: (detail: TaskDetail, outcomeId: string, note: string) => void;
  snooze: (row: TaskRow, option: TaskSnoozeOption) => void;
  reassign: (row: TaskRow, ownerId: string) => void;
  /** "Let Clinozy do it". */
  handOver: (row: TaskRow) => void;
}

/**
 * The task drawer's writes and what follows them (KICKOFF §6.10 Outcome flow;
 * `tasks.md:180–233`): every write toasts with Undo — "<task> · <result>",
 * "Snoozed · <label>", "You now own <name> · <owner> stays involved",
 * "<task> → <name> · <first> stays on it", "Clinozy is on it · <automation>".
 * An outcome, a snooze, a claim and "Let Clinozy do it" close the drawer; a
 * reassign keeps it. A closing outcome's follow-on opens its screen (a
 * booking, the person's record) — or, 380ms later, "What’s next". A failed
 * write toasts its error and leaves the drawer as it was.
 */
export function useTaskActions({
  assignees,
  close,
  openTarget,
  openWhatsNext,
}: TaskActionsOptions): TaskActions {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const outcomeWrite = useTaskOutcome();
  const snoozeWrite = useSnoozeTask();
  const reassignWrite = useReassignTask();
  const handWrite = useHandTaskToClinozy();
  const undo = useUndoTaskChange();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const busy =
    outcomeWrite.isPending ||
    snoozeWrite.isPending ||
    reassignWrite.isPending ||
    handWrite.isPending;
  const undoable = (message: string, change: TaskChange) =>
    notify.undo(message, { onUndo: () => undo.mutate(change.undoToken) });
  const shortName = (id: string | null) => {
    const staff = id ? assignees.byId.get(id) : undefined;
    return staff ? shortPersonName(staffName(staff)) : null;
  };
  /** Run a write; a failure has already toasted (the hooks' error toast), so it ends there. */
  const attempt = async (write: () => Promise<TaskChange>) => {
    try {
      return await write();
    } catch {
      return null;
    }
  };

  /** An outcome's toast: its snooze, the claim, or "<task> · <result>". */
  const outcomeToast = (
    detail: TaskDetail,
    outcome: TaskRuleOutcome,
    change: TaskChange,
    previousOwner: string | null,
  ): string => {
    if (outcome.disposition.type === 'snooze') {
      return t(TASKS_KEYS.toasts.snoozed, { label: change.task.snoozeLabel ?? '' });
    }
    if (outcome.effects.some((effect) => effect.type === 'claimLead')) {
      const name = taskContextLead(detail)?.name ?? detail.task.person.name;
      return previousOwner
        ? t(TASKS_KEYS.toasts.claimed, { name, owner: previousOwner })
        : t(TASKS_KEYS.toasts.claimedUnowned, { name });
    }
    return t(TASKS_KEYS.toasts.closed, {
      title: detail.task.title,
      result: change.task.result ?? '',
    });
  };

  /** After the write: the follow-on screen, else back to the list — and "What’s next" 380ms on. */
  const followOnAfter = (outcome: TaskRuleOutcome, row: TaskRow, change: TaskChange) => {
    const { followOn, disposition } = outcome;
    const target = followOn.opens ? taskFollowOnTarget(followOn.opens, row) : null;
    if (target) {
      openTarget(target);
      return;
    }
    close();
    if (!(followOn.whatsNext && disposition.type === 'close')) return;
    timer.current = setTimeout(
      () => openWhatsNext({ task: change.task, result: change.task.result ?? '' }),
      WHATS_NEXT_DELAY_MS,
    );
  };

  const recordOutcome = async (detail: TaskDetail, outcomeId: string, note: string) => {
    const row = detail.task;
    const outcome = findTaskOutcome(row.rule, outcomeId);
    if (!outcome || busy) return;
    // "Fix the number" writes nothing: it only opens the person's record.
    if (outcome.disposition.type === 'none' && outcome.effects.length === 0) {
      const target = outcome.followOn.opens
        ? taskFollowOnTarget(outcome.followOn.opens, row)
        : null;
      if (target) openTarget(target);
      else close();
      return;
    }
    // The owner a claim leaves involved, named before the write moves the lead.
    const previousOwner = shortName(taskContextLead(detail)?.ownerId ?? null);
    const change = await attempt(() =>
      outcomeWrite.mutateAsync({
        taskId: row.id,
        outcome: outcomeId,
        note: note.trim() || undefined,
      }),
    );
    if (!change) return;
    undoable(outcomeToast(detail, outcome, change, previousOwner), change);
    followOnAfter(outcome, row, change);
  };

  const snooze = async (row: TaskRow, option: TaskSnoozeOption) => {
    if (busy) return;
    const change = await attempt(() =>
      snoozeWrite.mutateAsync({ taskId: row.id, option }),
    );
    if (!change) return;
    undoable(
      t(TASKS_KEYS.toasts.snoozed, { label: change.task.snoozeLabel ?? '' }),
      change,
    );
    close();
  };

  const reassign = async (row: TaskRow, ownerId: string) => {
    if (busy || ownerId === row.ownerId) return;
    const change = await attempt(() =>
      reassignWrite.mutateAsync({ taskId: row.id, ownerId }),
    );
    if (!change) return;
    const name = shortName(ownerId) ?? '';
    const previous = row.owner?.firstName;
    undoable(
      previous
        ? t(TASKS_KEYS.toasts.moved, { title: row.title, name, previous })
        : t(TASKS_KEYS.toasts.movedUnowned, { title: row.title, name }),
      change,
    );
  };

  const handOver = async (row: TaskRow) => {
    const key = TASK_RULE_KEYS.rules[row.rule].automation;
    if (busy || !key || !TASK_RULES[row.rule].automation) return;
    const change = await attempt(() => handWrite.mutateAsync(row.id));
    if (!change) return;
    undoable(
      t(TASKS_KEYS.toasts.automation, { automation: lowerFirst(tRules(key)) }),
      change,
    );
    close();
  };

  return {
    busy,
    recordOutcome: (detail, outcomeId, note) =>
      void recordOutcome(detail, outcomeId, note),
    snooze: (row, option) => void snooze(row, option),
    reassign: (row, ownerId) => void reassign(row, ownerId),
    handOver: (row) => void handOver(row),
  };
}
