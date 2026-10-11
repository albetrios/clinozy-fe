import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  it('says nothing needs you, with "New task", when To do is empty', async () => {
    const onNewTask = vi.fn();
    renderList({ rows: [], onNewTask });
    expect(screen.queryAllByRole('rowgroup')).toHaveLength(1);
    expect(screen.getByTestId('tasks-empty')).toHaveTextContent(
      'Nothing needs you right now. New tasks appear here as leads write, visits come up and feedback arrives.',
    );
    await userEvent.setup().click(screen.getByTestId('tasks-empty-new'));
    expect(onNewTask).toHaveBeenCalledOnce();
  });

  it('keeps no "New task" for a member who cannot create one', () => {
    renderList({ rows: [] });
    expect(screen.queryByTestId('tasks-empty-new')).toBeNull();
  });

  it('renders the Snoozed and Done empty lines under their headers (§7.3)', () => {
    const { rerenderList } = renderList({ tab: 'snoozed', rows: [] });
    const snoozed = screen.getByTestId('tasks-group-snoozed');
    expect(snoozed).toHaveTextContent('Snoozed');
    expect(within(snoozed).getByTestId('tasks-empty')).toHaveTextContent(
      'No snoozed tasks',
    );
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
