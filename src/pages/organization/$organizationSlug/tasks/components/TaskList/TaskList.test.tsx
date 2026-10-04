import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { taskRowFixture } from '../../__tests__/integration/task-row-fixture.ts';
import { TaskList, type TaskListProps } from './TaskList.tsx';

vi.mock('@/shared/hooks/useCanHover/index.ts', () => ({ useCanHover: () => true }));

/** 10:30 in the clinic on Sun 4 Oct 2026. */
const NOW = new Date('2026-10-04T05:00:00.000Z');

const LATE = taskRowFixture({
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Rebook Vikram',
  rule: 'rebook',
  dueAt: '2026-10-04T04:15:00.000Z',
});
const SOON = taskRowFixture({
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Confirm Priti’s visit',
  dueAt: '2026-10-04T05:20:00.000Z',
});
const LATER = taskRowFixture({
  id: '00000000-0000-4000-8000-000000000003',
  title: 'Recall Tanvi',
  rule: 'recall',
  dueAt: '2026-10-06T05:30:00.000Z',
});

function renderList(props: Partial<TaskListProps> = {}) {
  const onOpen = vi.fn();
  const view = render(
    <TaskList
      tab="queue"
      rows={[LATER, SOON, LATE]}
      loading={false}
      refreshing={false}
      now={NOW}
      handled={() => false}
      onOpen={onOpen}
      hasNextPage={false}
      isFetchingNextPage={false}
      fetchNextPage={vi.fn()}
      {...props}
    />,
  );
  return { ...view, onOpen };
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
    expect(titlesIn('later')).toEqual(['Recall Tanvi']);
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
    const { rerender } = renderList({ tab: 'snoozed', rows: [] });
    const snoozed = screen.getByTestId('tasks-group-snoozed');
    expect(snoozed).toHaveTextContent('Snoozed');
    expect(within(snoozed).getByTestId('tasks-empty')).toHaveTextContent(
      'No snoozed tasks',
    );
    rerender(
      <TaskList
        tab="done"
        rows={[]}
        loading={false}
        refreshing={false}
        now={NOW}
        handled={() => false}
        onOpen={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />,
    );
    const done = screen.getByTestId('tasks-group-done');
    expect(done).toHaveTextContent('Resolved');
    expect(within(done).getByTestId('tasks-empty')).toHaveTextContent(
      'Nothing resolved yet today',
    );
  });

  it('shows skeleton rows on the first load, and bars in place while a new view loads', () => {
    const { rerender } = renderList({ loading: true });
    expect(screen.getByTestId('skeleton-rows')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    rerender(
      <TaskList
        tab="queue"
        rows={[SOON]}
        loading={false}
        refreshing
        now={NOW}
        handled={() => false}
        onOpen={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />,
    );
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-busy', 'true');
    expect(table.className).toContain('pointer-events-none');
  });

  it('opens a row', async () => {
    const { onOpen } = renderList();
    await userEvent.setup().click(screen.getByText('Recall Tanvi'));
    expect(onOpen).toHaveBeenCalledWith(LATER);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderList();
    expect(await axe(container)).toHaveNoViolations();
  });
});
