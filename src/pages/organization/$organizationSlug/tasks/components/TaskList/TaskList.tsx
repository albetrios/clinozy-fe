import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  groupTasks,
  TASK_GROUP_TONES,
  type TaskGroup,
} from '@/shared/api/clinic/task-views.ts';
import type {
  TaskRow as TaskRowRecord,
  TaskRuleId,
  TaskTab,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import {
  SKELETON_IN_PLACE,
  SkeletonRows,
} from '@/shared/components/SkeletonRows/index.ts';
import {
  type LoadMorePaging,
  useLoadMoreSentinel,
} from '@/shared/hooks/useLoadMoreSentinel/index.ts';
import { useTaskDueLabel } from '@/shared/hooks/useTaskDueLabel/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { TaskRow } from '../TaskRow/index.ts';

/** The rows a first load stands in for, at the row's 56px. */
const SKELETON_ROWS = 8;
/** The rows a next page stands in for while it loads. */
const LOADING_MORE_ROWS = 2;
/** The row metrics a skeleton row borrows. */
const SKELETON_ROW = 'h-14 border-b border-b-muted px-(--table-pad-x)';
/** The five columns a group header or an empty line spans. */
const COLUMNS = 5;

/** Props for {@link TaskList}. */
export interface TaskListProps extends LoadMorePaging {
  /** The view the rows belong to — it picks the groups and the empty line. */
  tab: TaskTab;
  rows: readonly TaskRowRecord[];
  /** The first load: the card shows skeleton rows. */
  loading: boolean;
  /** The rows belong to the previous view, search or type: they turn to bars in place. */
  refreshing: boolean;
  /** The clock the due labels and the groups read. */
  now: Date;
  /** The rule is handed to the product (the row's "Clinozy can do this" pill). */
  handled: (rule: TaskRuleId) => boolean;
  onOpen: (row: TaskRowRecord) => void;
  /** "New task" under the To do empty line — absent without Create. */
  onNewTask?: () => void;
  /** The contact card's actions for a row's person. */
  contactActions?: (row: TaskRowRecord) => ContactCardActions;
  className?: string;
}

/** A group's sticky header: an 8px square in the group's tone (none for Snoozed and Resolved) and the label. */
function GroupHeader({ group }: { group: TaskGroup<TaskRowRecord> }) {
  const { t } = useTranslation(TASKS_NS);
  const tone = TASK_GROUP_TONES[group.id];
  return (
    <div role="row" tabIndex={-1} className="sticky top-0 z-2">
      <div
        role="cell"
        aria-colspan={COLUMNS}
        className="bg-canvas text-micro text-muted-foreground-strong flex items-center gap-2 border-b px-(--table-pad-x) py-2 font-semibold tracking-[0.05em] uppercase"
      >
        <span
          aria-hidden="true"
          className={cn(
            'size-2 flex-none rounded-xs',
            tone ? TONE_CLASSES[tone].dot : null,
          )}
        />
        {t(TASKS_KEYS.groups[group.id])}
      </div>
    </div>
  );
}

/** A view's empty line (13px, muted, max 420px, centred, 48px down) — To do's with "New task". */
function EmptyLine({ tab, onNewTask }: { tab: TaskTab; onNewTask?: () => void }) {
  const { t } = useTranslation(TASKS_NS);
  return (
    <div role="row" tabIndex={-1}>
      <div
        role="cell"
        aria-colspan={COLUMNS}
        data-testid={TASKS_TEST_IDS.empty}
        className="mx-auto my-12 flex max-w-105 flex-col items-center gap-3 px-(--table-pad-x) text-center"
      >
        <p className="text-body text-muted-foreground leading-normal text-pretty">
          {t(TASKS_KEYS.empty[tab])}
        </p>
        {tab === 'queue' && onNewTask ? (
          <EmptyStateAction data-testid={TASKS_TEST_IDS.emptyNew} onClick={onNewTask}>
            {t(TASKS_KEYS.primary.newTask)}
          </EmptyStateAction>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The Tasks list card (KICKOFF §6.10 List card and Rows; `tasks.md:18–38`): a
 * grouped list, not the shared table — no header row, sort, selection or
 * footer. To do groups its rows under sticky "Overdue · Due today · Coming up"
 * headers (an empty group hidden; none at all is the empty line with "New
 * task"); Snoozed and Done are one group each, their empty line under the
 * header (§7.3). The first load shows skeleton rows; a new view, search or
 * type turns the rows on screen to bars until the next arrive. Cursor pages of
 * 50 load as the end scrolls in (D7) — no end line.
 */
export function TaskList({
  tab,
  rows,
  loading,
  refreshing,
  now,
  handled,
  onOpen,
  onNewTask,
  contactActions,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  className,
}: TaskListProps) {
  const { t } = useTranslation(TASKS_NS);
  const dueLabel = useTaskDueLabel();
  const sentinelRef = useRef<HTMLDivElement>(null);
  useLoadMoreSentinel(sentinelRef, {
    hasNextPage: hasNextPage && !loading && !refreshing,
    isFetchingNextPage,
    fetchNextPage,
  });
  const groups = groupTasks(rows, tab, now);
  const label = t(TASKS_KEYS.views[tab]);

  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground m-(--room-card-margin) flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border',
        className,
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <SkeletonRows
            rows={SKELETON_ROWS}
            avatar
            label={t(TASKS_KEYS.manifest.title)}
            rowClassName={SKELETON_ROW}
          />
        ) : (
          <div
            role="table"
            aria-label={label}
            aria-busy={refreshing || undefined}
            data-testid={TASKS_TEST_IDS.list}
            data-tab={tab}
            className={cn(refreshing && SKELETON_IN_PLACE)}
          >
            {groups.map((group) => (
              <div
                key={group.id}
                role="rowgroup"
                data-testid={TASKS_TEST_IDS.group(group.id)}
              >
                <GroupHeader group={group} />
                {group.rows.map((row) => (
                  <TaskRow
                    key={row.id}
                    row={row}
                    due={dueLabel(row, now)}
                    now={now}
                    handled={handled(row.rule)}
                    onOpen={onOpen}
                    contactActions={contactActions?.(row)}
                  />
                ))}
                {group.rows.length === 0 ? <EmptyLine tab={tab} /> : null}
              </div>
            ))}
            {groups.length === 0 ? (
              <div role="rowgroup">
                <EmptyLine tab={tab} onNewTask={onNewTask} />
              </div>
            ) : null}
          </div>
        )}
        {isFetchingNextPage ? (
          <SkeletonRows rows={LOADING_MORE_ROWS} avatar rowClassName={SKELETON_ROW} />
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      </div>
    </div>
  );
}
