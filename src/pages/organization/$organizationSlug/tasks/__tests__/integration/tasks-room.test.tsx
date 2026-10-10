import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import { saveMyPreferences } from '@/shared/api/clinic/preferences-api.ts';
import type * as TasksApiModule from '@/shared/api/clinic/tasks-api.ts';
import {
  deleteTask,
  listTasks,
  saveTaskRuleSettings,
} from '@/shared/api/clinic/tasks-api.ts';
import type { TaskListQueryInput } from '@/shared/api/clinic/tasks-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { TEST_TASK_ID } from '@/tests/utils/task-doubles.ts';

import { TasksPage } from '../../TasksPage.tsx';
import {
  ADAJAN,
  CREATED_TASK,
  NOW,
  seededTasksWorld,
  type TasksWorld,
} from './tasks-test-data.ts';
import {
  renderTasksRoutes,
  resetTasksRoutes,
  TASKS_FRONT_DESK_CODES,
} from './tasks-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const world = vi.hoisted(() => ({}) as TasksWorld);
vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => {
  const { tasksApiDouble } = await import('./tasks-test-data.ts');
  return {
    ...(await importOriginal<typeof TasksApiModule>()),
    ...tasksApiDouble(world),
  };
});
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } = await import('./tasks-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(world),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => {
  const { RIYA: member } = await import('./tasks-test-data.ts');
  return {
    ...(await importOriginal<typeof MyMembershipModule>()),
    findMyMembershipId: async () => member.id,
  };
});

// The drawers over the list have their own suites (WP2, WP3) — stand-ins here.
vi.mock('../../hooks/useTasksDialogRoute/index.ts', async () => {
  const { useTasksDialogRouteStub } = await import('./tasks-test-router.tsx');
  return { useTasksDialogRoute: useTasksDialogRouteStub };
});
vi.mock('../../hooks/useTaskActions/index.ts', () => ({ useTaskActions: () => ({}) }));
vi.mock('../../components/NewTaskDrawer/index.ts', async () => {
  const { NewTaskDrawerStub } = await import('./tasks-dialog-stubs.tsx');
  return { NewTaskDrawer: NewTaskDrawerStub };
});
vi.mock('../../components/TaskDrawer/index.ts', async () => {
  const { TaskDrawerStub } = await import('./tasks-dialog-stubs.tsx');
  return { TaskDrawer: TaskDrawerStub };
});
vi.mock('../../components/WhatsNextSheet/index.ts', () => ({
  WhatsNextSheet: () => null,
}));

const TASKS = '/organization/acme/tasks';

const rows = () => screen.queryAllByTestId('tasks-row');
const titles = () =>
  rows().map((row) => row.querySelector('.text-field')?.textContent ?? '');
const rowOf = (title: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(title));
  if (!row) throw new Error(`no row for ${title}`);
  return row;
};

/** The query of the last list read. */
const lastListQuery = (): TaskListQueryInput => {
  const query = vi.mocked(listTasks).mock.lastCall?.[0];
  if (!query) throw new Error('the list was never read');
  return query;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  Object.assign(world, seededTasksWorld());
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listTasks).mockClear();
  vi.mocked(saveTaskRuleSettings).mockClear();
  vi.mocked(deleteTask).mockClear();
});
afterEach(() => {
  resetTasksRoutes();
  vi.useRealTimers();
});

describe('the Tasks room on clinozy-be (KICKOFF §6.10)', () => {
  it('lists my To do and my queue’s, grouped by due time, each owner named', async () => {
    const { container } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    expect(lastListQuery()).toMatchObject({
      tab: 'open',
      scope: 'mine',
      type: [],
      q: '',
    });
    // Mine: my two and the front desk queue's reply — not Asha's call-back.
    expect(titles()).toEqual([
      'Reply to Anaya',
      'Confirm Priti’s visit',
      'Call Rhea about her package',
    ]);
    const table = screen.getByRole('table', { name: 'To do' });
    expect(
      within(table)
        .getAllByRole('rowgroup')
        .map((group) => group.dataset.testid),
    ).toEqual(['tasks-group-overdue', 'tasks-group-today', 'tasks-group-later']);
    await waitFor(() =>
      expect(rowOf('Confirm Priti’s visit')).toHaveTextContent('Riya S. (you)'),
    );
    expect(rowOf('Reply to Anaya')).toHaveTextContent('Front desk');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('widens to every owner with "Everyone"', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(screen.getByTestId('tasks-scope-tab-everyone'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ scope: 'everyone' }),
    );
    await waitFor(() => expect(titles()).toContain('Call Kavya back · unhappy'));
    expect(lastListQuery()).toMatchObject({ scope: 'everyone' });
    expect(rowOf('Call Kavya back · unhappy')).toHaveTextContent('Asha M.');
  });

  it('switches to Snoozed and Done through the URL — "Done by <product>" for the server’s', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('tasks-tab-snoozed'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: 'snoozed' }),
    );
    await waitFor(() => expect(titles()).toEqual(['Has Faizan arrived?']));
    expect(rowOf('Has Faizan arrived?')).toHaveTextContent('Snoozed · Running late');
    await user.click(screen.getByTestId('tasks-tab-done'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(titles()).toContain('Confirm Walkin’s visit'));
    expect(screen.getByRole('table', { name: 'Done' })).toBeInTheDocument();
    expect(rowOf('Confirm Walkin’s visit')).toHaveTextContent(/Done by \S+$/);
    expect(rowOf('Ask Kavya about her review')).toHaveTextContent('✓ Called');
  });

  it('keeps an empty view’s header and line', async () => {
    const user = userEvent.setup();
    world.tasks = world.tasks.filter((task) => task.status !== 'snoozed');
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('tasks-tab-snoozed'));
    await user.keyboard('{Enter}');
    const group = await screen.findByTestId('tasks-group-snoozed');
    expect(within(group).getByTestId('tasks-empty')).toHaveTextContent(
      'No snoozed tasks',
    );
  });

  it('filters by type — rules and "Follow-ups you set" together (D81 T6)', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(screen.getByTestId('tasks-type-trigger'));
    const panel = await screen.findByTestId('tasks-type-panel');
    await user.click(within(panel).getByRole('option', { name: /Confirm visits/ }));
    await user.click(within(panel).getByRole('option', { name: /Follow-ups you set/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        type: ['confirm', 'by_hand'],
      }),
    );
    await waitFor(() =>
      expect(titles()).toEqual(['Confirm Priti’s visit', 'Call Rhea about her package']),
    );
    expect(lastListQuery().type).toEqual(['confirm', 'by_hand']);
    expect(screen.getByTestId('tasks-type-trigger')).toHaveTextContent('2 types');
  });

  it('searches the title, the person and the why line', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'rhea');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ q: 'rhea' }),
    );
    await waitFor(() => expect(titles()).toEqual(['Call Rhea about her package']));
    expect(lastListQuery().q).toBe('rhea');
  });

  it('reads the header’s branches (D32) — the tasks under none kept', async () => {
    // The preferences are the suite's in-memory double (`clinic-shell-doubles.ts`).
    await saveMyPreferences({ branchFilter: [ADAJAN] });
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    expect(lastListQuery().branchIds).toEqual([ADAJAN]);
    expect(titles()).toContain('Call Rhea about her package');
  });

  it('drops a rule an admin switches off from the list, and brings it back', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(screen.getByTestId('tasks-rules-trigger'));
    const confirm = await screen.findByRole('switch', { name: 'Confirm visits' });
    await user.click(confirm);
    expect(vi.mocked(saveTaskRuleSettings).mock.lastCall?.[0]).toMatchObject({
      changes: [{ ruleKey: 'confirm', isOn: false }],
    });
    await waitFor(() => expect(titles()).not.toContain('Confirm Priti’s visit'));
    await user.click(screen.getByRole('switch', { name: 'Confirm visits' }));
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
  });

  it('hands a rule to the product — its rows carry the pill', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    expect(rowOf('Confirm Priti’s visit')).not.toHaveTextContent('can do this');
    await user.click(screen.getByTestId('tasks-rules-trigger'));
    await user.click(await screen.findByTestId('tasks-rule-confirm-handle'));
    expect(vi.mocked(saveTaskRuleSettings).mock.lastCall?.[0]).toMatchObject({
      changes: [{ ruleKey: 'confirm', isAutomatic: true }],
    });
    await waitFor(() =>
      expect(rowOf('Confirm Priti’s visit')).toHaveTextContent('can do this'),
    );
  });

  it('keeps the rules read-only without `organization:update`', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage, { permissions: TASKS_FRONT_DESK_CODES });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('tasks-rules-trigger'));
    expect(await screen.findByRole('switch', { name: 'Confirm visits' })).toBeDisabled();
    expect(screen.getByTestId('tasks-rule-confirm-handle')).toBeDisabled();
  });

  it('opens a task’s drawer route from its row, keeping the list’s params', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}?scope=everyone`, TasksPage);
    await waitFor(() => expect(titles()).toContain('Reply to Anaya'));
    await user.click(within(rowOf('Reply to Anaya')).getByText('Reply to Anaya'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${TASKS}/${TEST_TASK_ID}`),
    );
    expect(router.state.location.search).toEqual({ scope: 'everyone' });
    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument();
  });

  it('opens New task for `task:create`, and Undo deletes the new task for `task:delete`', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}?scope=everyone`, TasksPage);
    await user.click(await screen.findByTestId('tasks-new'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${TASKS}/create`));
    expect(router.state.location.search).toEqual({ scope: 'everyone' });
    await user.click(
      within(await screen.findByTestId('new-task-drawer')).getByText('Save'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(notifyMock.undo).toHaveBeenCalledWith(
      expect.stringContaining('Riya S.'),
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    options.onUndo();
    await waitFor(() =>
      expect(vi.mocked(deleteTask).mock.lastCall?.[0]).toEqual({
        taskId: CREATED_TASK.id,
        reason: 'mistake',
        note: null,
      }),
    );
  });

  it('offers no Undo of a new task without `task:delete` (no way back on the API, Q7)', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage, { permissions: TASKS_FRONT_DESK_CODES });
    await user.click(await screen.findByTestId('tasks-new'));
    await user.click(
      within(await screen.findByTestId('new-task-drawer')).getByText('Save'),
    );
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('offers no New task without `task:create` — nor to a Pharmacist', async () => {
    const { unmount } = renderTasksRoutes(TASKS, TasksPage, {
      permissions: ['organization:read', 'task:read', 'task:update'],
    });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(screen.queryByTestId('tasks-new')).not.toBeInTheDocument();
    unmount();
    renderTasksRoutes(TASKS, TasksPage, { role: 'pharmacist' });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(screen.queryByTestId('tasks-new')).not.toBeInTheDocument();
  });

  it('reads nothing without `task:read` — no list read, an empty To do', async () => {
    renderTasksRoutes(TASKS, TasksPage, { permissions: ['organization:read'] });
    expect(await screen.findByTestId('tasks-empty')).toBeInTheDocument();
    expect(listTasks).not.toHaveBeenCalled();
  });

  it('shows the error with Retry in place when the first read fails', async () => {
    const user = userEvent.setup();
    world.failList = true;
    renderTasksRoutes(TASKS, TasksPage);
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    world.failList = false;
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
  });

  it('keeps the rows and toasts a failed load with Retry (§6.0 List error)', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    world.failList = true;
    await user.click(screen.getByTestId('tasks-tab-done'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
    expect(rows().length).toBeGreaterThan(0);
    expect(screen.queryByTestId('retry-error')).toBeNull();
  });
});
