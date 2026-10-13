import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTask } from '@/shared/api/app/tasks-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { taskRow, TEST_TASK_ID } from '@/tests/utils/task-doubles.ts';

import {
  renderTasksRoutes,
  resetTasksRoutes,
  TASKS_FRONT_DESK_CODES,
} from '../../__tests__/integration/tasks-test-router.tsx';
import { useTasksDialogRoute } from './useTasksDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTask: vi.fn(),
}));

const TASKS = '/organization/acme/tasks';
/** A link from the fixture days: no public id, never read. */
const FIXTURE_ID = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';
const LEAD = 'lead_hplz5ew0h3tw99ntqf39w';

/** Shows what the hook reads, and closes and retries through it. */
function Probe() {
  const { dialog, close } = useTasksDialogRoute();
  return (
    <>
      <output>
        {JSON.stringify({
          kind: dialog.kind,
          taskId: dialog.kind === 'task' ? dialog.taskId : null,
          title: dialog.kind === 'task' ? (dialog.detail?.task.title ?? null) : null,
          ...(dialog.kind === 'task' && dialog.isError ? { isError: true } : {}),
          ...(dialog.kind === 'create' ? { prefill: dialog.prefill } : {}),
        })}
      </output>
      <button type="button" onClick={close}>
        Close
      </button>
      {dialog.kind === 'task' ? (
        <button type="button" onClick={dialog.retry}>
          Retry
        </button>
      ) : null}
    </>
  );
}

const read = () => JSON.parse(screen.getByRole('status').textContent ?? '{}') as unknown;

const notFound = () =>
  new HttpError('Not Found', 404, `/api/v1/app/tasks/${TEST_TASK_ID}`, 'GET', {
    error: { type: 'request_error', code: 'not_found', detail: 'Task not found' },
  });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchTask).mockReset();
  vi.mocked(fetchTask).mockResolvedValue({ task: taskRow(), source: null, quote: null });
});
afterEach(() => {
  resetTasksRoutes();
});

describe('useTasksDialogRoute (D24, S:97, S:115)', () => {
  it('opens nothing over the bare list', async () => {
    renderTasksRoutes(TASKS, Probe);
    await waitFor(() =>
      expect(read()).toEqual({ kind: 'none', taskId: null, title: null }),
    );
    expect(fetchTask).not.toHaveBeenCalled();
  });

  it('reads the task the URL names under the member’s codes, and opens it', async () => {
    renderTasksRoutes(`${TASKS}/${TEST_TASK_ID}`, Probe);
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'task',
        taskId: TEST_TASK_ID,
        title: 'Reply to Anaya',
      }),
    );
    const [taskId, canRead] = vi.mocked(fetchTask).mock.lastCall ?? [];
    expect(taskId).toBe(TEST_TASK_ID);
    // The record and quote reads follow the member's codes (the harness's Admin).
    expect(canRead?.('task:delete')).toBe(true);
    expect(canRead?.('payment:read')).toBe(false);
  });

  it('answers a task the server doesn’t know with the list in place and "Task not found"', async () => {
    vi.mocked(fetchTask).mockRejectedValue(notFound());
    const { router } = renderTasksRoutes(`${TASKS}/${TEST_TASK_ID}?tab=snoozed`, Probe);
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(router.state.location.search).toEqual({ tab: 'snoozed' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Task not found · it may have been deleted',
    );
    expect(read()).toMatchObject({ kind: 'none' });
  });

  it('never reads an id that is no task’s — a link from the fixture days', async () => {
    const { router } = renderTasksRoutes(`${TASKS}/${FIXTURE_ID}`, Probe);
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Task not found · it may have been deleted',
    );
    expect(fetchTask).not.toHaveBeenCalled();
  });

  it('keeps the drawer open on a failed read, and Retry reads it again', async () => {
    vi.mocked(fetchTask).mockRejectedValue(new Error('connection dropped'));
    const user = userEvent.setup();
    renderTasksRoutes(`${TASKS}/${TEST_TASK_ID}`, Probe);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'task', isError: true }), {
      timeout: 5_000,
    });
    vi.mocked(fetchTask).mockResolvedValue({
      task: taskRow(),
      source: null,
      quote: null,
    });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(read()).toMatchObject({ title: 'Reply to Anaya' }));
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('closes onto the list with its own params', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(
      `${TASKS}/${TEST_TASK_ID}?scope=everyone`,
      Probe,
    );
    await waitFor(() => expect(read()).toMatchObject({ kind: 'task' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(router.state.location.search).toEqual({ scope: 'everyone' });
  });

  it('opens New task, with the lead the URL names', async () => {
    renderTasksRoutes(`${TASKS}/create?lead=${LEAD}&scope=everyone`, Probe);
    await waitFor(() =>
      expect(read()).toMatchObject({ kind: 'create', prefill: { lead: LEAD } }),
    );
  });

  it('closes New task onto the list, its prefill dropped', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}/create?lead=${LEAD}&tab=done`, Probe);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'create' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(router.state.location.search).toEqual({ tab: 'done' });
  });

  it('sends a member without task:create back to the list with the permission toast', async () => {
    const { router } = renderTasksRoutes(`${TASKS}/create`, Probe, {
      permissions: TASKS_FRONT_DESK_CODES.filter((code) => code !== 'task:create'),
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(notifyMock.info).toHaveBeenCalledOnce();
    expect(read()).toMatchObject({ kind: 'none' });
  });
});
