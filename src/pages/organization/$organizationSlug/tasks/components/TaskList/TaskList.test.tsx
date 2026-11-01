import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { TaskRow } from '@/shared/api/app/tasks-contracts.ts';
import { taskRow } from '@/tests/utils/task-doubles.ts';

import type { TaskRowTeam } from '../TaskRow/index.ts';
import { TaskList, type TaskListProps } from './TaskList.tsx';

vi.mock('@/shared/hooks/useCanHover/index.ts', () => ({ useCanHover: () => true }));

/** 10:30 in the clinic on Sat 10 Oct 2026. */
const NOW = new Date('2026-10-10T05:00:00.000Z');

const LATE = taskRow({
  id: 'task_late',
  title: 'Rebook Vikram',
  type: 'rebook',
  ruleKey: 'rebook',
  dueAt: '2026-10-10T04:15:00.000Z',
});
const SOON = taskRow({
  id: 'task_soon',
  title: 'Confirm Priti’s visit',
  type: 'confirm',
  ruleKey: 'confirm',
  dueAt: '2026-10-10T05:20:00.000Z',
});
const LATER = taskRow({
  id: 'task_later',
  title: 'Call Tanvi',
  type: 'by_hand',
  ruleKey: null,
  kind: 'manual',
  dueAt: '2026-10-12T05:30:00.000Z',
});

const TEAM: TaskRowTeam = { byId: new Map(), myMembershipId: null, updatedAt: null };

function listProps(props: Partial<TaskListProps> = {}): TaskListProps {
  return {
    tab: 'open',
    rows: [LATER, SOON, LATE],
    loading: false,
    refreshing: false,
    failed: false,
    onRetry: vi.fn(),
    now: NOW,
    handled: () => false,
    team: TEAM,
    onOpen: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...props,
  };
}

function renderList(props: Partial<TaskListProps> = {}) {
  const all = listProps(props);
  const view = render(<TaskList {...all} />);
  return {
    ...view,
    onOpen: all.onOpen,
    onRetry: all.onRetry,
    rerenderList: (patch: Partial<TaskListProps>) =>
      view.rerender(<TaskList {...listProps(patch)} />),
  };
}

const titlesIn = (group: string) =>
  within(screen.getByTestId(`tasks-group-${group}`))
    .getAllByTestId('tasks-row')
    .map((row) => row.querySelector('.text-field')?.textContent);

describe('TaskList (tasks.md:18–38)', () => {
  it('groups To do under Overdue · Due today · Coming up, each by due time', () => {
    renderList();
    const groups = within(screen.getByRole('table', { name: 'To do' })).getAllByRole(
      'rowgroup',
    );
    expect(groups.map((group) => group.dataset.testid)).toEqual([
      'tasks-group-overdue',
      'tasks-group-today',
      'tasks-group-later',
    ]);
    expect(titlesIn('overdue')).toEqual(['Rebook Vikram']);
    expect(titlesIn('today')).toEqual(['Confirm Priti’s visit']);
    expect(titlesIn('later')).toEqual(['Call Tanvi']);
    expect(screen.getByTestId('tasks-group-overdue')).toHaveTextContent('Overdue');
    expect(screen.getByText('Overdue').querySelector('span')).toHaveClass(
      'bg-tone-blush-dot',
    );
  });

  it('words each row’s due label', () => {
    renderList();
    expect(
      within(screen.getByTestId('tasks-group-overdue')).getByText('45 min overdue'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('tasks-group-today')).getByText('in 20 min'),
    ).toBeInTheDocument();
  });

  it('keeps Snoozed and Done in the server’s order, one group each', () => {
    renderList({
      tab: 'done',
      rows: [
        { ...SOON, status: 'done', isResolvedAutomatically: true },
        {
          ...LATE,
          status: 'done',
          resultText: 'Rebooked',
          resolvedAt: NOW.toISOString(),
        },
      ],
    });
    expect(titlesIn('done')).toEqual(['Confirm Priti’s visit', 'Rebook Vikram']);
    expect(screen.getByRole('table', { name: 'Done' })).toBeInTheDocument();
  });

  it('marks the rows whose rule is handed to the product', () => {
    renderList({ handled: (row: TaskRow) => row.ruleKey === 'confirm' });
    const rows = screen.getAllByTestId('tasks-row');
    const handed = rows.filter((row) => row.textContent?.includes('can do this'));
    expect(handed.map((row) => row.dataset.taskId)).toEqual(['task_soon']);
  });

  it('says nothing needs you, with no button, when To do is empty', () => {
    renderList({ rows: [] });
    expect(screen.queryAllByRole('rowgroup')).toHaveLength(1);
    const empty = screen.getByTestId('tasks-empty');
    expect(within(empty).getByRole('heading', { name: 'All caught up' })).toBeVisible();
    expect(empty).toHaveTextContent(
      'Nothing needs you right now. New tasks appear here as leads write, visits come up and feedback arrives.',
    );
    // The plum room look, centred: the list, its row group, row and cell grow.
    expect(within(empty).getByTestId('empty-state')).toHaveAttribute('data-tone', 'plum');
    expect(empty).toHaveClass('flex-1');
    expect(screen.getByTestId('tasks-list')).toHaveClass('flex-1');
    // The toolbar's "New task" is the one way to add (fix-empty-state-actions).
    expect(within(empty).queryByRole('button')).toBeNull();
  });

  it('renders the Snoozed and Done empty lines under their headers (§7.3)', () => {
    const { rerenderList } = renderList({ tab: 'snoozed', rows: [] });
    const snoozed = screen.getByTestId('tasks-group-snoozed');
    expect(snoozed).toHaveTextContent('Snoozed');
    expect(within(snoozed).getByTestId('tasks-empty')).toHaveTextContent(
      'No snoozed tasks',
    );
    expect(
      within(snoozed).getByRole('heading', { name: 'No snoozed tasks' }),
    ).toBeVisible();
    rerenderList({ tab: 'done', rows: [] });
    const done = screen.getByTestId('tasks-group-done');
    expect(done).toHaveTextContent('Resolved');
    expect(within(done).getByTestId('tasks-empty')).toHaveTextContent(
      'Nothing resolved yet today',
    );
  });

  it('shows skeleton rows on the first load, and bars in place while a new view loads', () => {
    const { rerenderList } = renderList({ loading: true });
    expect(screen.getByTestId('skeleton-rows')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    rerenderList({ rows: [SOON], refreshing: true });
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-busy', 'true');
    // Each group's rows are its items: the rooms' one in-place skeleton (index.css).
    for (const group of within(table).getAllByRole('rowgroup')) {
      expect(group).toHaveAttribute('data-refreshing', 'true');
    }
  });

  it('shows the error with Retry in place when the read failed with nothing to show', async () => {
    const { onRetry } = renderList({ rows: [], failed: true });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByTestId('retry-error')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('opens a row', async () => {
    const { onOpen } = renderList();
    await userEvent.setup().click(screen.getByText('Call Tanvi'));
    expect(onOpen).toHaveBeenCalledWith(LATER);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderList();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TaskList — a long list renders only the rows in view (G-2)', () => {
  /** A minute past `NOW`, `minutes` later (negative: earlier). */
  const at = (minutes: number) =>
    new Date(NOW.getTime() + minutes * 60_000).toISOString();
  const tasks = (label: string, count: number, dueAt: (index: number) => string) =>
    Array.from({ length: count }, (_, index) =>
      taskRow({
        id: `task_${label.toLowerCase()}_${index + 1}`,
        title: `${label} task ${index + 1}`,
        dueAt: dueAt(index),
      }),
    );
  /*
   * 30 overdue, 40 due later today and 80 on Monday: 150 rows under three headers, 153 entries —
   * Overdue's header is entry 0, Due today's 31 and Coming up's 72.
   */
  const LONG = [
    ...tasks('Overdue', 30, (index) => at(index - 30)),
    ...tasks('Today', 40, (index) => at(index + 1)),
    ...tasks('Monday', 80, (index) => at(2 * 24 * 60 + index)),
  ];
  /** The scroller's height in px: ten rows' worth. */
  const VIEWPORT = 560;
  /** Where Coming up's 38th row (entry 110) starts: two groups, its header and 37 rows above. */
  const MONDAY_ROW_THIRTY_EIGHT = 33 + 30 * 56 + 33 + 40 * 56 + 33 + 37 * 56;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEWPORT);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const group = (id: string) => screen.getByTestId(`tasks-group-${id}`);
  const rowsIn = (id: string) => within(group(id)).queryAllByTestId('tasks-row');
  const rowIndexes = (id: string) =>
    rowsIn(id).map((row) => Number(row.getAttribute('aria-rowindex')));

  it('draws the first screen of rows, every group still its own rowgroup', () => {
    renderList({ rows: LONG });
    const table = screen.getByRole('table', { name: 'To do' });
    expect(table).toHaveAttribute('aria-rowcount', '153');
    expect(
      within(table)
        .getAllByRole('rowgroup')
        .map((rowgroup) => rowgroup.dataset.testid),
    ).toEqual(['tasks-group-overdue', 'tasks-group-today', 'tasks-group-later']);

    // Ten rows in view plus ten overscan — never the 150.
    const rendered = screen.getAllByTestId('tasks-row');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThanOrEqual(20);
    expect(rowIndexes('overdue')).toEqual(
      Array.from({ length: rendered.length }, (_, index) => index + 2),
    );
    // The groups below are one spacer each: no header, no row.
    for (const id of ['today', 'later']) {
      expect(within(group(id)).queryAllByRole('row')).toHaveLength(0);
      expect(group(id).firstElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('keeps a group’s header stuck over its rows after the header scrolls past', () => {
    renderList({ rows: LONG });
    const scroller = screen.getByTestId('tasks-list').parentElement as HTMLElement;
    scroller.scrollTop = MONDAY_ROW_THIRTY_EIGHT;
    fireEvent.scroll(scroller);

    expect(rowsIn('overdue')).toHaveLength(0);
    expect(rowsIn('today')).toHaveLength(0);
    const header = within(group('later')).getAllByRole('row')[0];
    expect(header).toHaveTextContent('Coming up');
    expect(header).toHaveClass('sticky', 'top-0');
    expect(header).toHaveAttribute('aria-rowindex', '73');
    // The rows Coming up starts with sit above the window: a spacer holds their height.
    expect(header?.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
    const indexes = rowIndexes('later');
    expect(indexes).toContain(111);
    expect(indexes.length).toBeLessThanOrEqual(30);
    expect(indexes).toEqual(
      Array.from({ length: indexes.length }, (_, index) => (indexes[0] ?? 0) + index),
    );
    expect(within(group('later')).getByText('Monday task 38')).toBeInTheDocument();
  });

  it('opens a windowed row from the keyboard, the header staying out of the tab order', async () => {
    const { onOpen } = renderList({ rows: LONG });
    const [header, first] = within(group('overdue')).getAllByRole('row');
    expect(header).toHaveAttribute('tabindex', '-1');
    expect(first).toHaveAttribute('tabindex', '0');
    first?.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(LONG[0]);
  });

  it('renders every row, unindexed, at 60 entries and under', () => {
    // 30 overdue and 28 due today: 58 rows under two headers.
    renderList({ rows: LONG.slice(0, 58) });
    expect(screen.getAllByTestId('tasks-row')).toHaveLength(58);
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-rowcount');
    expect(screen.getAllByTestId('tasks-row')[0]).not.toHaveAttribute('aria-rowindex');
  });

  it('has no accessibility violations while it virtualises', async () => {
    const { container } = renderList({ rows: LONG });
    expect(await axe(container)).toHaveNoViolations();
  });
});
