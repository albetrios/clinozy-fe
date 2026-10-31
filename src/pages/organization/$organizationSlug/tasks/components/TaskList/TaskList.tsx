import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { type CSSProperties, type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import {
  groupTasks,
  TASK_GROUP_TONES,
  type TaskGroup,
} from '@/shared/api/app/task-views.ts';
import type {
  TaskRow as TaskRowRecord,
  TaskTab,
} from '@/shared/api/app/tasks-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import {
  type LoadMorePaging,
  useLoadMoreSentinel,
} from '@/shared/hooks/useLoadMoreSentinel/index.ts';
import { useTaskDueLabel } from '@/shared/hooks/useTaskDueLabel/index.ts';
import { type AppIcon, CheckCircle, Clock, SquareCheck } from '@/shared/icons/index.ts';

import { TASKS_KEYS, TASKS_NS, TASKS_TEST_IDS } from '../../tasks.constants.ts';
import { TaskRow, type TaskRowTeam } from '../TaskRow/index.ts';
import {
  type GroupWindow,
  groupWindows,
  type TaskListLayout,
  taskListLayout,
  VIRTUALIZE_ABOVE,
  withGroupHeaders,
} from './task-list-window.ts';

/** The rows a first load stands in for, at the row's 56px. */
const SKELETON_ROWS = 8;
/** The rows a next page stands in for while it loads. */
const LOADING_MORE_ROWS = 2;
/** The row metrics a skeleton row borrows. */
const SKELETON_ROW = 'h-14 border-b border-b-muted px-(--table-pad-x)';
/*
 * The list is an ARIA table on `div`s: each row is a CSS grid that re-grids
 * into two lines on a phone (TaskRow) and each group header is sticky inside
 * its group, and native `<table>` parts lose their table semantics once their
 * `display` is changed — so the `NOSONAR(S6819)` marks on `role="table"`,
 * `rowgroup`, `row` and `cell` here and in TaskRow are deliberate.
 */

/** The five columns a group header or an empty line spans. */
const COLUMNS = 5;
/** A row's height before it is measured (the row's 56px). */
const ROW_HEIGHT = 56;
/** A group header's height before it is measured. */
const HEADER_HEIGHT = 33;
/** Entries rendered beyond the ones in view while the list virtualises. */
const OVERSCAN = 10;

/** Props for {@link TaskList}. */
export interface TaskListProps extends LoadMorePaging {
  /** The view the rows belong to — it picks the groups and the empty line. */
  tab: TaskTab;
  rows: readonly TaskRowRecord[];
  /** The first load: the card shows skeleton rows. */
  loading: boolean;
  /** The rows belong to the previous view, search or type: they turn to bars in place. */
  refreshing: boolean;
  /** The read failed with nothing to show: the card says so, with Retry (KICKOFF §6.0 States). */
  failed: boolean;
  onRetry: () => void;
  /** The clock the due labels and the groups read. */
  now: Date;
  /** The row's rule is handed to Clinozy (its "Clinozy can do this" pill). */
  handled: (row: TaskRowRecord) => boolean;
  /** The team the rows name their owners from. */
  team: TaskRowTeam;
  onOpen: (row: TaskRowRecord) => void;
  /** The contact card's actions for a row's person. */
  contactActions?: (row: TaskRowRecord) => ContactCardActions;
  className?: string;
}

/** While the list virtualises: an entry's place in the whole list and the ref that measures it. */
type Windowed = { index: number; measure: (node: HTMLDivElement | null) => void };

/** A group's sticky header: an 8px square in the group's tone (none for Snoozed and Resolved) and the label. */
function GroupHeader({
  group,
  windowed,
}: {
  group: TaskGroup<TaskRowRecord>;
  windowed?: Windowed;
}) {
  const { t } = useTranslation(TASKS_NS);
  const tone = TASK_GROUP_TONES[group.id];
  return (
    <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
      ref={windowed?.measure}
      role="row"
      tabIndex={-1}
      data-index={windowed?.index}
      aria-rowindex={windowed ? windowed.index + 1 : undefined}
      className="sticky top-0 z-2"
    >
      <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
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

/** Each view's empty-state glyph (change-empty-states R34–R36). */
const EMPTY_ICONS: Readonly<Record<TaskTab, AppIcon>> = {
  open: SquareCheck,
  snoozed: Clock,
  done: CheckCircle,
};

/**
 * A view's empty state (change-empty-states R34–R36): the room look in the
 * Tasks plum, centred in the list card — To do's "All caught up" over the
 * queue line; Snoozed's and Done's line as the title, under their group header.
 * No button (fix-empty-state-actions): the toolbar's "New task" is the one way
 * to add.
 */
function EmptyLine({ tab }: { tab: TaskTab }) {
  const { t } = useTranslation(TASKS_NS);
  const Icon = EMPTY_ICONS[tab];
  const open = tab === 'open';
  return (
    <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
      role="row"
      tabIndex={-1}
      className="flex flex-1 flex-col"
    >
      <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
        role="cell"
        aria-colspan={COLUMNS}
        data-testid={TASKS_TEST_IDS.empty}
        className="flex flex-1 flex-col"
      >
        <EmptyState
          tone="plum"
          icon={<Icon />}
          title={t(open ? TASKS_KEYS.emptyCaughtUp : TASKS_KEYS.empty[tab])}
          description={open ? t(TASKS_KEYS.empty.open) : undefined}
        />
      </div>
    </div>
  );
}

/**
 * What {@link GroupedRows} draws: the list's rows and how each reads, and its scroller — the
 * element itself, not a ref: the scroller is the parent's, attached only after this child's
 * layout effects ran, so a ref would leave the virtualizer without it until some later render.
 */
type GroupedRowsProps = Pick<
  TaskListProps,
  'tab' | 'rows' | 'refreshing' | 'now' | 'handled' | 'team' | 'onOpen' | 'contactActions'
> & { scroller: HTMLDivElement | null };

/** Space the rows out of view hold while the list virtualises (px, `--task-gap`). */
function Gap({ height }: { height: number }) {
  if (height <= 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{ '--task-gap': `${height}px` } as CSSProperties}
      className="h-(--task-gap)"
    />
  );
}

/**
 * Above {@link VIRTUALIZE_ABOVE} entries (headers counted) only the rows in view, plus
 * {@link OVERSCAN}, render — measured as they mount — each group keeping its rowgroup and its
 * sticky header (`task-list-window.ts`, G-2). `null` while every row renders.
 */
function useGroupWindows(
  layout: TaskListLayout,
  scroller: HTMLDivElement | null,
): { windows: GroupWindow[]; measure: (node: HTMLDivElement | null) => void } | null {
  const virtualizing = layout.entries.length > VIRTUALIZE_ABOVE;
  const estimate = (index: number) =>
    layout.entries[index]?.kind === 'header' ? HEADER_HEIGHT : ROW_HEIGHT;
  // The virtualizer re-renders this component as it scrolls; its stable
  // `measureElement` is all that leaves the component.
  // eslint-disable-next-line react-hooks/incompatible-library -- see above
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: layout.entries.length,
    getScrollElement: () => scroller,
    estimateSize: estimate,
    // An unlaid-out entry reads 0 tall; keep the estimate instead.
    measureElement: (element) =>
      element.getBoundingClientRect().height ||
      estimate(Number(element.dataset.index ?? 0)),
    // The first render draws a window before the scroller is measured.
    initialRect: { width: 0, height: ROW_HEIGHT * OVERSCAN },
    overscan: OVERSCAN,
    enabled: virtualizing,
    getItemKey: (index) => layout.entries[index]?.key ?? index,
    rangeExtractor: (range) => withGroupHeaders(defaultRangeExtractor(range), layout),
  });
  if (!virtualizing) return null;
  const inView = virtualizer.getVirtualItems().map((item) => item.index);
  // A scroller with no height yet (hidden, not laid out) gets a first window rather than nothing.
  const rendered = new Set(
    inView.length > 0
      ? inView
      : withGroupHeaders(
          layout.entries.slice(0, OVERSCAN * 2).map((_, index) => index),
          layout,
        ),
  );
  const spans = virtualizer.measurementsCache;
  return {
    windows: groupWindows(layout, rendered, (index) => {
      const span = spans[index];
      return span ? { start: span.start, end: span.end } : { start: 0, end: 0 };
    }),
    measure: virtualizer.measureElement,
  };
}

/** The view's groups, each under its sticky header, or the view's empty line. */
function GroupedRows({
  tab,
  rows,
  refreshing,
  now,
  handled,
  team,
  onOpen,
  contactActions,
  scroller,
}: GroupedRowsProps) {
  const { t } = useTranslation(TASKS_NS);
  // Rows sit under "Due today" / "Coming up": today's due times read bare.
  const dueLabel = useTaskDueLabel({ sameDay: true });
  const groups = groupTasks(rows, tab, now);
  const layout = taskListLayout(groups);
  const windowing = useGroupWindows(layout, scroller);
  const renderRow = (row: TaskRowRecord, index?: number) => (
    <TaskRow
      key={row.id}
      row={row}
      due={dueLabel(row, now)}
      now={now}
      handled={handled(row)}
      team={team}
      onOpen={onOpen}
      contactActions={contactActions?.(row)}
      windowed={
        windowing && index !== undefined
          ? { index, measure: windowing.measure }
          : undefined
      }
    />
  );
  return (
    <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
      role="table"
      aria-label={t(TASKS_KEYS.views[tab])}
      aria-busy={refreshing || undefined}
      aria-rowcount={windowing ? layout.entries.length : undefined}
      data-testid={TASKS_TEST_IDS.list}
      data-tab={tab}
      // An empty view grows into the card, so its empty state centres there.
      className={cn(rows.length === 0 && 'flex flex-1 flex-col')}
    >
      {groups.map((group, groupIndex) => {
        const shown = windowing?.windows[groupIndex];
        const header = layout.headerAt[groupIndex] ?? 0;
        let body: ReactNode;
        if (shown?.hiddenHeight != null) {
          body = <Gap height={shown.hiddenHeight} />;
        } else if (shown && windowing) {
          body = (
            <>
              <GroupHeader
                group={group}
                windowed={{ index: header, measure: windowing.measure }}
              />
              <Gap height={shown.padBefore} />
              {shown.rows.map((index) => {
                const row = group.rows[index - header - 1];
                return row ? renderRow(row, index) : null;
              })}
              <Gap height={shown.padAfter} />
            </>
          );
        } else {
          body = (
            <>
              <GroupHeader group={group} />
              {group.rows.map((row) => renderRow(row))}
              {group.rows.length === 0 ? <EmptyLine tab={tab} /> : null}
            </>
          );
        }
        return (
          <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
            key={group.id}
            role="rowgroup"
            // Bars in place while a new view loads — the rooms' one skeleton (index.css).
            data-refreshing={refreshing || undefined}
            data-testid={TASKS_TEST_IDS.group(group.id)}
            className={cn(group.rows.length === 0 && 'flex flex-1 flex-col')}
          >
            {body}
          </div>
        );
      })}
      {groups.length === 0 ? (
        <div // NOSONAR(S6819): grid ARIA table, see the note above COLUMNS
          role="rowgroup"
          className="flex flex-1 flex-col"
        >
          <EmptyLine tab={tab} />
        </div>
      ) : null}
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
 * type turns the rows on screen to bars until the next arrive; a read that
 * fails with nothing to show is the error with Retry, in place. Cursor pages
 * of 50 (`GET /app/tasks`, the server's due order) load as the end scrolls in
 * (D7) — no end line. Above 60 entries only the rows in view render, each group
 * keeping its rowgroup and sticky header (`task-list-window.ts`, G-2).
 */
export function TaskList({
  tab,
  rows,
  loading,
  refreshing,
  failed,
  onRetry,
  now,
  handled,
  team,
  onOpen,
  contactActions,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  className,
}: TaskListProps) {
  const { t } = useTranslation(TASKS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useLoadMoreSentinel(sentinelRef, {
    hasNextPage: hasNextPage && !loading && !refreshing && !failed,
    isFetchingNextPage,
    fetchNextPage,
  });

  let body: ReactNode;
  if (loading) {
    body = (
      <SkeletonRows
        rows={SKELETON_ROWS}
        avatar
        label={t(TASKS_KEYS.manifest.title)}
        rowClassName={SKELETON_ROW}
      />
    );
  } else if (failed) {
    body = (
      <RetryError
        message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
        onRetry={onRetry}
      />
    );
  } else {
    body = (
      <GroupedRows
        tab={tab}
        rows={rows}
        refreshing={refreshing}
        now={now}
        handled={handled}
        team={team}
        onOpen={onOpen}
        contactActions={contactActions}
        scroller={scroller}
      />
    );
  }

  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground m-(--room-card-margin) flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border',
        className,
      )}
    >
      <div ref={setScroller} className="flex min-h-0 flex-1 flex-col overflow-auto">
        {body}
        {isFetchingNextPage ? (
          <SkeletonRows rows={LOADING_MORE_ROWS} avatar rowClassName={SKELETON_ROW} />
        ) : null}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      </div>
    </div>
  );
}
