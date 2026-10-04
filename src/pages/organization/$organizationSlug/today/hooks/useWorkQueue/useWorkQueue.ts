import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  findTaskOutcome,
  type TaskChange,
  type TaskRow,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { taskFollowOnTarget, type TaskTarget } from '@/shared/clinic/task-targets.ts';
import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import {
  useTaskList,
  useTaskOutcome,
  useUndoTaskChange,
} from '@/shared/hooks/useTasks/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { TODAY_KEYS, TODAY_NS } from '../../today.constants.ts';

/** The work queue's scopes: "Mine" (tasks the member owns) · "Everyone". */
export type WorkQueueScope = 'mine' | 'everyone';

/** One card of the work queue: its task, and its result once closed here or today. */
export interface WorkQueueEntry {
  row: TaskRow;
  /** "✓ <result>" — closed; null while open. */
  result: string | null;
  /** An outcome is on its way: the buttons wait. */
  busy: boolean;
}

/** What the aside shows and does. */
export interface WorkQueue {
  entries: WorkQueueEntry[];
  /** Every open task, whatever the scope (`today.md:69`). */
  openCount: number;
  /** The first load: the list wears its skeleton. */
  loading: boolean;
  record: (row: TaskRow, outcomeId: string) => void;
}

/** A closing write this screen made: in flight (no result yet) or closed with its result. */
interface Closing {
  row: TaskRow;
  result: string | null;
}

/** Load every page of a list, so the count holds and nothing hides past the first 50. */
function useAllPages(list: CursorListResult<TaskRow>) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
}

const byDue = (a: WorkQueueEntry, b: WorkQueueEntry) =>
  a.row.dueAt.localeCompare(b.row.dueAt) || a.row.title.localeCompare(b.row.title);

/**
 * Today's work queue (KICKOFF §6.2 Work queue aside; Q-T3 — one task model with
 * the Tasks room): the open tasks by due time with the ones closed today, all
 * owners read so "<n> open" counts every open task; "Mine" keeps the ones the
 * member owns (`ownedByViewer`, the Tasks room's viewer rule). An outcome is the
 * Tasks room's write (`useTaskOutcome`): the card closes in place with "✓
 * <result>", the toast says "<name>: <result>" with Undo, and an outcome whose
 * follow-on is a screen opens it (`onFollowOn`) — "What’s next" chains only in
 * the Tasks room (`tasks.md:140`).
 */
export function useWorkQueue({
  scope,
  onFollowOn,
}: {
  scope: WorkQueueScope;
  onFollowOn: (target: TaskTarget) => void;
}): WorkQueue {
  const { t } = useTranslation(TODAY_NS);
  const queue = useTaskList(
    { tab: 'queue', scope: 'everyone' },
    { notifyOnError: false },
  );
  const done = useTaskList({ tab: 'done', scope: 'everyone' }, { notifyOnError: false });
  useAllPages(queue);
  useAllPages(done);
  const outcomeWrite = useTaskOutcome();
  const undo = useUndoTaskChange();
  const [closing, setClosing] = useState<ReadonlyMap<string, Closing>>(new Map());

  const { refetch: refetchQueue } = queue;
  const { refetch: refetchDone } = done;
  const retry = useCallback(() => {
    refetchQueue();
    refetchDone();
  }, [refetchQueue, refetchDone]);
  const open = useListLoadError(
    {
      isError: queue.isError || done.isError,
      refetch: retry,
      rows: queue.rows,
      isPending: queue.isPending,
    },
    'today-queue',
  );

  const entries = useMemo(() => {
    const server = new Map<string, TaskRow>();
    for (const row of done.rows) if (row.exists) server.set(row.id, row);
    for (const row of open) server.set(row.id, row);
    const ids = new Set([...server.keys(), ...closing.keys()]);
    const all: WorkQueueEntry[] = [];
    for (const id of ids) {
      const row = server.get(id);
      const mine = closing.get(id);
      if (row?.status === 'done') {
        all.push({ row, result: row.result ?? mine?.result ?? '', busy: false });
      } else if (mine) {
        all.push({
          row: row ?? mine.row,
          result: mine.result,
          busy: mine.result === null,
        });
      } else if (row) {
        all.push({ row, result: null, busy: false });
      }
    }
    return all
      .filter((entry) => scope === 'everyone' || entry.row.ownedByViewer)
      .sort(byDue);
  }, [open, done.rows, closing, scope]);

  const settle = (id: string, next: Closing | null) =>
    setClosing((previous) => {
      const map = new Map(previous);
      if (next) map.set(id, next);
      else map.delete(id);
      return map;
    });

  const record = async (row: TaskRow, outcomeId: string) => {
    const outcome = findTaskOutcome(row.rule, outcomeId);
    if (!outcome || closing.get(row.id)?.result === null) return;
    const target = outcome.followOn.opens
      ? taskFollowOnTarget(outcome.followOn.opens, row)
      : null;
    // "Fix the number" writes nothing: it only opens the person's record.
    if (outcome.disposition.type === 'none' && outcome.effects.length === 0) {
      if (target) onFollowOn(target);
      return;
    }
    const leaves = outcome.disposition.type !== 'none';
    if (leaves) settle(row.id, { row, result: null });
    let change: TaskChange;
    try {
      change = await outcomeWrite.mutateAsync({ taskId: row.id, outcome: outcomeId });
    } catch {
      // The write's hook toasted its error; the card is open again.
      settle(row.id, null);
      return;
    }
    const result =
      outcome.disposition.type === 'snooze'
        ? t(TODAY_KEYS.toasts.snoozed, { label: change.task.snoozeLabel ?? '' })
        : (change.task.result ?? '');
    settle(row.id, leaves ? { row, result } : null);
    const undoToken = change.undoToken;
    notify.undo(t(TODAY_KEYS.toasts.outcome, { name: row.person.name, result }), {
      onUndo: () => {
        settle(row.id, null);
        undo.mutate(undoToken);
      },
    });
    if (target) onFollowOn(target);
  };

  return {
    entries,
    openCount: open.length,
    loading: queue.isPending || done.isPending,
    record: (row, outcomeId) => void record(row, outcomeId),
  };
}
