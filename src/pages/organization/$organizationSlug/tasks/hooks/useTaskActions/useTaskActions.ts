import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import {
  findTaskOutcome,
  type TaskAssignee,
  type TaskDetail,
  type TaskOutcomePlan,
  type TaskRecord,
  type TaskRow,
  type TaskSnoozeOption,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { TASK_RULE_KEYS, TASK_RULES_NS } from '@/shared/clinic/task-rules.constants.ts';
import { taskFollowOnTarget, type TaskTarget } from '@/shared/clinic/task-targets.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import {
  useReassignTask,
  useSnoozeTask,
  useTaskOutcome,
} from '@/shared/hooks/useTasks/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import type { TaskAssignees } from '../useTaskAssignees/index.ts';

/** "What’s next" opens this long after a closing outcome (`tasks.md:180–233`, H:4293). */
export const WHATS_NEXT_DELAY_MS = 380;

/** The task a closing outcome closed, for "What’s next for <first>?". */
export interface WhatsNextFor {
  /** The closed task, with its person. */
  task: TaskRow;
  /** What closed it, in words ("Confirmed on call"). */
  result: string;
}

/** Options of {@link useTaskActions}. */
export interface TaskActionsOptions {
  assignees: TaskAssignees;
  /** Close the drawer: back to the list. */
  close: () => void;
  /** Open a follow-on screen or a record (the booking, the lead drawer, the file). */
  openTarget: (target: TaskTarget) => void;
  /** "What’s next for <first>?" over the list. */
  openWhatsNext: (next: WhatsNextFor) => void;
}

/** An outcome as the drawer records it: which one, its note, and the screen's clock. */
export interface TaskOutcomeChoice {
  outcomeId: string;
  note: string;
  /** The screen's "now" — the times the outcome sets count from it, so a retry sends the same. */
  now: Date;
}

/** What the task drawer does with a task. */
export interface TaskActions {
  /** A write is in flight: the drawer's actions wait (one write at a time). */
  busy: boolean;
  /** Close, snooze or act on the task with one of its type's outcomes. */
  recordOutcome: (detail: TaskDetail, choice: TaskOutcomeChoice) => void;
  /** Snooze it with one of the footer's options, counted from the screen's `now`. */
  snooze: (row: TaskRow, option: TaskSnoozeOption, now: Date) => void;
  /** Give it to a member or a role's queue. */
  reassign: (row: TaskRow, assignee: TaskAssignee) => void;
}

/** The refusal reason of a lead move the member's codes don't cover (D81 TASKS-M3). */
const MISSING_PERMISSION = 'missing_permission';

/** The refusal reason of a write on a task that is already done. */
const ALREADY_DONE = 'transition_not_allowed';

/** An outcome's button words in the `tasks` namespace — its result, call note and snooze label. */
function outcomeLabelKey(row: TaskRow, outcomeId: string): string | undefined {
  const copy = TASK_RULE_KEYS.rules[row.type].outcomes as Readonly<
    Record<string, { label: string; effect: string } | undefined>
  >;
  return copy[outcomeId]?.label;
}

/** Whether a reassign would leave the task where it is. */
function sameOwner(row: TaskRow, assignee: TaskAssignee): boolean {
  return 'membershipId' in assignee
    ? row.ownerId === assignee.membershipId
    : row.ownerId === null && row.ownerRole === assignee.role;
}

/** The task after a write: the record's fields over the row the drawer read (its person stays). */
const rowAfter = (row: TaskRow, record: TaskRecord): TaskRow => ({ ...row, ...record });

/**
 * The task drawer's writes and what follows them (KICKOFF §6.10 Outcome flow;
 * `tasks.md:180–233`) on clinozy-be — each toasts once it lands, with no Undo
 * (the API has no way back, research-tasks Q7): "<task> · <result>",
 * "Snoozed · <label>" (an outcome the server snoozes too — "No answer"),
 * "You now own <name>", "<task> → <name>". An outcome runs its plan
 * (`useTaskOutcome`: the record writes, then the task's resolve or snooze),
 * its words the button's label and its times counted from the screen's `now`;
 * an outcome, a snooze and a claim close the drawer, a reassign keeps it. A
 * closing outcome's follow-on opens its screen (a booking, a check-in or
 * review, the person's record) — or, 380ms later, "What’s next" for a member
 * who may create tasks. A refusal toasts in the room's words where it has
 * them — a task already closed (read again), a lead's task the member may not
 * move or claim — and leaves the drawer as it was.
 */
export function useTaskActions({
  assignees,
  close,
  openTarget,
  openWhatsNext,
}: TaskActionsOptions): TaskActions {
  const { t } = useTranslation(TASKS_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const queryClient = useQueryClient();
  const access = useClinicAccess();
  const outcomeWrite = useTaskOutcome({ notifyOnError: false });
  const snoozeWrite = useSnoozeTask({ notifyOnError: false });
  const reassignWrite = useReassignTask({ notifyOnError: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const busy = outcomeWrite.isPending || snoozeWrite.isPending || reassignWrite.isPending;

  /** A refusal in the room's words: a lead the member may not move, a task already closed. */
  const refused = (error: unknown, needsLeads: string | null) => {
    const reason = apiErrorReason(error);
    if (reason === ALREADY_DONE) {
      // Someone — or the rules — closed it first: read it again (the drawer closes itself).
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      notify.info(t(TASKS_KEYS.toasts.alreadyClosed));
      return;
    }
    notify.error(
      reason === MISSING_PERMISSION && needsLeads ? needsLeads : mapApiError(error),
    );
  };

  /** Run a write; a refusal toasts (`needsLeads`: the words for a lead it may not touch). */
  const attempt = async <T>(
    write: () => Promise<T>,
    needsLeads: string | null = null,
  ): Promise<T | null> => {
    try {
      return await write();
    } catch (error) {
      refused(error, needsLeads);
      return null;
    }
  };

  /** Who a task goes to, in words: the member's short name, else the role's queue. */
  const assigneeName = (assignee: TaskAssignee) => {
    if ('role' in assignee) return tClinic(CLINIC_KEYS.roles[assignee.role]);
    const member = assignees.byId.get(assignee.membershipId);
    return member ? shortPersonName(member.name) : '';
  };

  /** An outcome's toast: a snooze (the server's or the plan's), the claim, or "<task> · <result>". */
  const outcomeToast = (
    detail: TaskDetail,
    plan: TaskOutcomePlan,
    record: TaskRecord,
    words: string,
  ): string => {
    if (record.status === 'snoozed') {
      return t(TASKS_KEYS.toasts.snoozed, { label: record.snoozeLabel ?? words });
    }
    if (detail.task.type === 'claim' && plan.write.type === 'resolve') {
      const lead = detail.source?.kind === 'lead' ? detail.source.lead.name : '';
      return t(TASKS_KEYS.toasts.claimed, {
        name: lead || (detail.task.person?.name ?? detail.task.title),
      });
    }
    return t(TASKS_KEYS.toasts.closed, {
      title: detail.task.title,
      result: record.resultText ?? words,
    });
  };

  /** After the write: the follow-on screen, else back to the list — and "What’s next" 380ms on. */
  const followOnAfter = (plan: TaskOutcomePlan, row: TaskRow, record: TaskRecord) => {
    const target = plan.opens ? taskFollowOnTarget(plan.opens, row) : null;
    if (target) {
      openTarget(target);
      return;
    }
    close();
    const closed = record.status === 'done';
    if (!(plan.whatsNext && closed && access.canCode('task:create'))) return;
    const task = rowAfter(row, record);
    timer.current = setTimeout(
      () => openWhatsNext({ task, result: record.resultText ?? '' }),
      WHATS_NEXT_DELAY_MS,
    );
  };

  const recordOutcome = async (detail: TaskDetail, choice: TaskOutcomeChoice) => {
    const row = detail.task;
    const plan = findTaskOutcome(row.type, choice.outcomeId);
    if (!plan || busy) return;
    // "Fix the number" writes nothing: it only opens the person's record.
    if (plan.write.type === 'none' && plan.steps.length === 0) {
      const target = plan.opens ? taskFollowOnTarget(plan.opens, row) : null;
      if (target) openTarget(target);
      else close();
      return;
    }
    const labelKey = outcomeLabelKey(row, plan.id);
    const words = labelKey ? tRules(labelKey) : plan.id;
    const claims = row.type === 'claim' && plan.write.type === 'resolve';
    const record = await attempt(
      () =>
        outcomeWrite.mutateAsync({
          task: row,
          outcomeId: plan.id,
          words,
          note: choice.note.trim() || null,
          now: choice.now.toISOString(),
          // "Retry send" queues the message the drawer quoted.
          failedActivityId:
            row.type === 'failed_message' ? (detail.quote?.activityId ?? null) : null,
        }),
      claims ? t(TASKS_KEYS.toasts.claimNeedsLeads) : null,
    );
    if (!record) return;
    notify.success(outcomeToast(detail, plan, record, words));
    followOnAfter(plan, row, record);
  };

  const snooze = async (row: TaskRow, option: TaskSnoozeOption, now: Date) => {
    if (busy) return;
    const label = tRules(TASK_RULE_KEYS.snoozeOptions[option]);
    const record = await attempt(() =>
      snoozeWrite.mutateAsync({ taskId: row.id, option, now: now.toISOString(), label }),
    );
    if (!record) return;
    notify.success(t(TASKS_KEYS.toasts.snoozed, { label: record.snoozeLabel ?? label }));
    close();
  };

  const reassign = async (row: TaskRow, assignee: TaskAssignee) => {
    if (busy || sameOwner(row, assignee)) return;
    const record = await attempt(
      () => reassignWrite.mutateAsync({ taskId: row.id, assignee }),
      t(TASKS_KEYS.toasts.reassignNeedsLeads),
    );
    if (!record) return;
    notify.success(
      t(TASKS_KEYS.toasts.moved, { title: row.title, name: assigneeName(assignee) }),
    );
  };

  return {
    busy,
    recordOutcome: (detail, choice) => {
      void recordOutcome(detail, choice);
    },
    snooze: (row, option, now) => {
      void snooze(row, option, now);
    },
    reassign: (row, assignee) => {
      void reassign(row, assignee);
    },
  };
}
