import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { taskQueryKeys } from '@/shared/api/app/tasks-api.ts';
import {
  findTaskOutcome,
  type TaskOutcomePlan,
  type TaskRecord,
  type TaskRow,
} from '@/shared/api/app/tasks-contracts.ts';
import {
  TASK_QUEUE_KEYS,
  TASK_RULE_KEYS,
  TASK_RULES_NS,
} from '@/shared/app/task-rules.constants.ts';
import { taskFollowOnTarget, type TaskTarget } from '@/shared/app/task-targets.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import {
  useOpenTaskCount,
  useTaskList,
  useTaskOutcome,
} from '@/shared/hooks/useTasks/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TODAY_KEYS, TODAY_NS } from '../../today.constants.ts';

/**
 * The work queue's scopes: "Mine" (the member's tasks and the unowned ones in their roles'
 * queues — the server's `scope=mine`) · "Everyone".
 */
export type WorkQueueScope = 'mine' | 'everyone';

/** One card of the work queue: its task, and its result once closed here or today. */
export interface WorkQueueEntry {
  row: TaskRow;
  /**
   * Closed: "✓ <result>" — a member's words, or "" for one the server closed ("Done by Clinozy"
   * is its due label). Null while open.
   */
  result: string | null;
  /** An outcome is on its way: the buttons wait. */
  busy: boolean;
}

/** What the aside shows and does. */
export interface WorkQueue {
  entries: WorkQueueEntry[];
  /** Every open task, whatever the scope, in the header's branches (`today.md:69`). */
  openCount: number;
  /** The first load: the list wears its skeleton. */
  loading: boolean;
  record: (row: TaskRow, outcomeId: string) => void;
}

/** A closing write this screen made, under the scope it was made in: in flight, or closed with its result. */
interface Closing {
  row: TaskRow;
  scope: WorkQueueScope;
  result: string | null;
}

/** The refusal reason of a write on a task someone — or the rules — closed first. */
const ALREADY_DONE = 'transition_not_allowed';

/** Load every page of a list, so nothing hides past the first 50. */
function useAllPages(list: CursorListResult<TaskRow>) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
}

const byDue = (a: WorkQueueEntry, b: WorkQueueEntry) =>
  a.row.dueAt.localeCompare(b.row.dueAt) || a.row.title.localeCompare(b.row.title);

/** A closed task's result line: the member's words; none for the server's own close. */
const closedResultOf = (row: TaskRecord) =>
  row.isResolvedAutomatically ? '' : (row.resultText ?? '');

/**
 * The cards: the server's open tasks and today's closed ones, each once, with the closes made
 * here in this scope kept in place — a snoozed one has left every list — by due time.
 */
function queueEntries(
  open: readonly TaskRow[],
  done: readonly TaskRow[],
  closing: ReadonlyMap<string, Closing>,
  scope: WorkQueueScope,
): WorkQueueEntry[] {
  const server = new Map<string, TaskRow>();
  for (const row of done) server.set(row.id, row);
  for (const row of open) server.set(row.id, row);
  const mine = [...closing.values()].filter((entry) => entry.scope === scope);
  const ids = new Set([...server.keys(), ...mine.map((entry) => entry.row.id)]);
  const entries: WorkQueueEntry[] = [];
  for (const id of ids) {
    const row = server.get(id);
    const closed = closing.get(id);
    if (row?.status === 'done') {
      entries.push({ row, result: closedResultOf(row), busy: false });
    } else if (closed?.scope === scope) {
      entries.push({
        row: row ?? closed.row,
        result: closed.result,
        busy: closed.result === null,
      });
    } else if (row) {
      entries.push({ row, result: null, busy: false });
    }
  }
  return entries.sort(byDue);
}

/**
 * An outcome's words in the member's language — its button's label, which is the result, the call
 * note and the snooze label it sends.
 */
function outcomeWordsOf(row: TaskRow, plan: TaskOutcomePlan, tRules: TFunction): string {
  const copy = TASK_RULE_KEYS.rules[row.type].outcomes as Readonly<
    Record<string, { label: string } | undefined>
  >;
  const label = copy[plan.id]?.label;
  return label ? tRules(label) : plan.id;
}

/**
 * Today's reads of the queue (KICKOFF §6.2): To do and today's Done in the scope and the header's
 * branches (D32, read once the preferences have loaded), every page, and "<n> open" — read only
 * with `enabled` (the member reads tasks); a failed read toasts once with Retry.
 */
function useQueueReads(scope: WorkQueueScope, enabled: boolean) {
  const { preferences, isPending: preferencesPending } = usePreferences();
  const branchIds = preferences.branchFilter;
  const options = { enabled: enabled && !preferencesPending, notifyOnError: false };
  const open = useTaskList({ tab: 'open', scope, branchIds }, options);
  const done = useTaskList({ tab: 'done', scope, branchIds }, options);
  const count = useOpenTaskCount({ ...options, branchIds });
  useAllPages(open);
  useAllPages(done);

  const { refetch: refetchOpen } = open;
  const { refetch: refetchDone } = done;
  const { refetch: refetchCount } = count;
  const retry = useCallback(() => {
    refetchOpen();
    refetchDone();
    void refetchCount();
  }, [refetchOpen, refetchDone, refetchCount]);
  const openRows = useListLoadError(
    {
      isError: open.isError || done.isError || count.isError,
      refetch: retry,
      rows: open.rows,
      isPending: open.isPending,
    },
    'today-queue',
  );
  return {
    openRows,
    doneRows: done.rows,
    openCount: count.data ?? openRows.length,
    loading: enabled && (open.isPending || done.isPending || count.isPending),
  };
}

/**
 * Today's work queue (KICKOFF §6.2 Work queue aside; Q-T3 — one task model with the Tasks room)
 * on clinozy-be: the open tasks of the scope by due time with the ones closed today
 * (`GET /app/tasks?tab=open|done&scope=…`, the header's branches), and "<n> open" — every open
 * task, whatever the scope (`useOpenTaskCount`). Read only for a member who reads tasks
 * (`enabled`). An outcome is the Tasks room's write (`useTaskOutcome`: its record writes, then the
 * task's resolve or snooze): the card closes in place with "✓ <result>" (a snooze: "Snoozed ·
 * <label>"), the toast says "<name>: <result>" — no Undo, the API has no way back (Q7) — and an
 * outcome whose follow-on is a screen opens it (`onFollowOn`); "What’s next" chains only in the
 * Tasks room (`tasks.md:140`). A task someone — or the rules — closed first reads the room's words
 * and the queue again; any other refusal toasts the server's.
 */
export function useWorkQueue({
  scope,
  enabled,
  onFollowOn,
}: {
  scope: WorkQueueScope;
  /** The member reads tasks (`task:read`): without it nothing is read. */
  enabled: boolean;
  onFollowOn: (target: TaskTarget) => void;
}): WorkQueue {
  const { t } = useTranslation(TODAY_NS);
  const { t: tRules } = useTranslation(TASK_RULES_NS);
  const queryClient = useQueryClient();
  const reads = useQueueReads(scope, enabled);
  const outcomeWrite = useTaskOutcome({ notifyOnError: false });
  const [closing, setClosing] = useState<ReadonlyMap<string, Closing>>(new Map());

  const entries = useMemo(
    () => queueEntries(reads.openRows, reads.doneRows, closing, scope),
    [reads.openRows, reads.doneRows, closing, scope],
  );

  const settle = (id: string, next: Closing | null) =>
    setClosing((previous) => {
      const map = new Map(previous);
      if (next) map.set(id, next);
      else map.delete(id);
      return map;
    });

  /** A refusal: a task closed first reads the queue again in the room's words; else the server's. */
  const refused = (error: unknown) => {
    if (apiErrorReason(error) === ALREADY_DONE) {
      void queryClient.invalidateQueries({ queryKey: taskQueryKeys.all });
      notify.info(tRules(TASK_QUEUE_KEYS.alreadyClosed));
      return;
    }
    notifyError(error);
  };

  /** The outcome's write: the card waits, then shows its result and toasts — or opens again. */
  const write = async (row: TaskRow, plan: TaskOutcomePlan): Promise<boolean> => {
    const words = outcomeWordsOf(row, plan, tRules);
    settle(row.id, { row, scope, result: null });
    let task: TaskRecord | null;
    try {
      task = await outcomeWrite.mutateAsync({
        task: row,
        outcomeId: plan.id,
        words,
        note: null,
        // The times it sets count from the press, so a retry sends the same body.
        now: new Date().toISOString(),
        failedActivityId: null,
      });
    } catch (error) {
      settle(row.id, null);
      refused(error);
      return false;
    }
    const result =
      task?.status === 'snoozed'
        ? t(TODAY_KEYS.toasts.snoozed, { label: task.snoozeLabel ?? words })
        : (task?.resultText ?? words);
    settle(row.id, { row, scope, result });
    notify.success(
      t(TODAY_KEYS.toasts.outcome, { name: row.person?.name ?? row.title, result }),
    );
    return true;
  };

  const record = async (row: TaskRow, outcomeId: string) => {
    const plan = findTaskOutcome(row.type, outcomeId);
    if (!plan || closing.get(row.id)?.result === null) return;
    // "Fix the number" writes nothing: it only opens the person's record.
    const writes = plan.write.type !== 'none' || plan.steps.length > 0;
    if (writes && !(await write(row, plan))) return;
    const target = plan.opens ? taskFollowOnTarget(plan.opens, row) : null;
    if (target) onFollowOn(target);
  };

  return {
    entries,
    openCount: reads.openCount,
    loading: reads.loading,
    record: (row, outcomeId) => {
      void record(row, outcomeId);
    },
  };
}
