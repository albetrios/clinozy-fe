import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listTasks: vi.fn(),
  fetchTask: vi.fn(),
  countOpenTasks: vi.fn(),
  fetchTaskWorkerIds: vi.fn(),
  fetchTaskRuleSettings: vi.fn(),
  saveTaskRuleSettings: vi.fn(),
  recordTaskOutcome: vi.fn(),
  snoozeTask: vi.fn(),
  reassignTask: vi.fn(),
  addTask: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
}));
const access = vi.hoisted(() => ({
  isResolved: true,
  canCode: (code: string) => code !== 'lead:read',
}));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => access,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import {
  addTask,
  countOpenTasks,
  deleteTask,
  fetchTask,
  fetchTaskRuleSettings,
  fetchTaskWorkerIds,
  listTasks,
  reassignTask,
  recordTaskOutcome,
  restoreTask,
  saveTaskRuleSettings,
  snoozeTask,
  taskQueryKeys,
} from '@/shared/api/clinic/tasks-api.ts';
import { TASKS_REFETCH_MS } from '@/shared/api/clinic/tasks-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { taskRecord, taskRow, TEST_TASK_ID } from '@/tests/utils/task-doubles.ts';

import {
  useCreateTask,
  useDeleteTask,
  useOpenTaskCount,
  useReassignTask,
  useRestoreTask,
  useSaveTaskRuleSettings,
  useSnoozeTask,
  useTask,
  useTaskList,
  useTaskOutcome,
  useTaskRuleSettings,
  useTaskWorkerIds,
} from './useTasks.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  access.isResolved = true;
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

const OTHER = taskRow({ id: 'task_other00000000000000', title: 'Confirm Riya’s visit' });

/** A list showing the reply task and another, with the hooks under test beside it. */
async function listed<T>(hook: () => T) {
  vi.mocked(listTasks).mockResolvedValue({
    rows: [taskRow(), OTHER],
    next: null,
    total: 2,
  });
  const view = renderHook(
    () => ({ list: useTaskList({ scope: 'everyone' }), hook: hook() }),
    {
      wrapper,
    },
  );
  await waitFor(() => expect(view.result.current.list.rows).toHaveLength(2));
  return view;
}

describe('useTaskList', () => {
  it('reads a view’s pages under the organization and polls them every 60s', async () => {
    vi.mocked(listTasks)
      .mockResolvedValueOnce({ rows: [taskRow()], next: 'cur_2', total: 2 })
      .mockResolvedValueOnce({ rows: [OTHER], next: null, total: 2 });
    const { result } = renderHook(() => useTaskList({ tab: 'snoozed' }), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(listTasks).toHaveBeenCalledWith({ tab: 'snoozed' }, undefined);
    expect(result.current.hasNextPage).toBe(true);
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(listTasks).toHaveBeenLastCalledWith({ tab: 'snoozed' }, 'cur_2');

    const query = client
      .getQueryCache()
      .find({ queryKey: taskQueryKeys.list('org_test', { tab: 'snoozed' }) });
    expect(query?.observers[0]?.options.refetchInterval).toBe(TASKS_REFETCH_MS);
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useTaskList({}), { wrapper });
    expect(listTasks).not.toHaveBeenCalled();
  });
});

describe('the reads beside the list', () => {
  it('reads the drawer’s task with the member’s codes, once their access is known', async () => {
    access.isResolved = false;
    vi.mocked(fetchTask).mockResolvedValue({
      task: taskRow(),
      source: null,
      quote: null,
    });
    const { result, rerender } = renderHook(() => useTask(TEST_TASK_ID), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');

    access.isResolved = true;
    rerender();
    await waitFor(() => expect(result.current.data?.task.id).toBe(TEST_TASK_ID));
    const [taskId, canRead] = vi.mocked(fetchTask).mock.calls[0] ?? [];
    expect(taskId).toBe(TEST_TASK_ID);
    expect(canRead?.('lead:read')).toBe(false);
    expect(canRead?.('appointment:read')).toBe(true);

    const { result: idle } = renderHook(() => useTask(null), { wrapper });
    expect(idle.current.fetchStatus).toBe('idle');
  });

  it('counts the open tasks, and reads who can work them and the rules', async () => {
    vi.mocked(countOpenTasks).mockResolvedValue(7);
    vi.mocked(fetchTaskWorkerIds).mockResolvedValue(['mem_a']);
    vi.mocked(fetchTaskRuleSettings).mockResolvedValue({
      confirm: { isOn: true, isAutomatic: false, canBeAutomatic: true, updatedAt: null },
    });
    const { result } = renderHook(
      () => ({
        open: useOpenTaskCount(),
        workers: useTaskWorkerIds(),
        rules: useTaskRuleSettings(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.open.data).toBe(7));
    await waitFor(() => expect(result.current.workers.data).toEqual(['mem_a']));
    await waitFor(() => expect(result.current.rules.data?.confirm?.isOn).toBe(true));
    expect(countOpenTasks).toHaveBeenCalledWith([]);
  });

  it('counts the open tasks in the header’s branches, one entry for the same branches in any order', async () => {
    vi.mocked(countOpenTasks).mockResolvedValue(3);
    const { result } = renderHook(
      () => ({
        first: useOpenTaskCount({ branchIds: ['brn_b', 'brn_a'] }),
        second: useOpenTaskCount({ branchIds: ['brn_a', 'brn_b', 'brn_a'] }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.second.data).toBe(3));
    expect(countOpenTasks).toHaveBeenCalledTimes(1);
    expect(countOpenTasks).toHaveBeenCalledWith(['brn_a', 'brn_b']);
  });
});

describe('useTaskOutcome', () => {
  const vars = {
    task: taskRow(),
    outcomeId: 'notInterested',
    words: 'Not interested',
    note: null,
    now: '2026-10-10T04:30:00.000Z',
    failedActivityId: null,
  };

  it('runs the outcome with the action’s key and takes the row out at once', async () => {
    let finish!: (value: null) => void;
    vi.mocked(recordTaskOutcome).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await listed(() => useTaskOutcome());
    act(() => {
      result.current.hook.mutate(vars);
    });
    await waitFor(() =>
      expect(result.current.list.rows.map((row) => row.id)).toEqual([OTHER.id]),
    );
    const [input] = vi.mocked(recordTaskOutcome).mock.calls[0] ?? [];
    expect(input).toMatchObject({ outcomeId: 'notInterested', words: 'Not interested' });
    expect(input?.idempotencyKey).toEqual(expect.any(String));
    await act(async () => {
      finish(null);
    });
  });

  it('puts the row back and toasts when the write fails; "Fix the number" leaves it', async () => {
    vi.mocked(recordTaskOutcome).mockRejectedValue(new Error('connection dropped'));
    const { result } = await listed(() => useTaskOutcome());
    await act(async () => {
      await result.current.hook.mutateAsync(vars).catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalled();
    await waitFor(() => expect(result.current.list.rows).toHaveLength(2));

    vi.mocked(recordTaskOutcome).mockReturnValue(new Promise(() => undefined));
    act(() => {
      result.current.hook.mutate({
        ...vars,
        task: taskRow({ ruleKey: 'failed_message', type: 'failed_message' }),
        outcomeId: 'fixTheNumber',
      });
    });
    expect(result.current.list.rows).toHaveLength(2);
  });
});

describe('the task’s writes', () => {
  it('snoozes (the row leaves at once) and moves a task', async () => {
    vi.mocked(snoozeTask).mockReturnValue(new Promise(() => undefined));
    vi.mocked(reassignTask).mockResolvedValue(taskRecord({ ownerId: 'mem_a' }));
    const { result } = await listed(() => ({
      snooze: useSnoozeTask(),
      reassign: useReassignTask(),
    }));
    act(() => {
      result.current.hook.snooze.mutate({
        taskId: TEST_TASK_ID,
        option: 'oneHour',
        now: '2026-10-10T04:30:00.000Z',
        label: '1 hour',
      });
    });
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    expect(snoozeTask).toHaveBeenCalledWith({
      taskId: TEST_TASK_ID,
      until: '2026-10-10T05:30:00.000Z',
      label: '1 hour',
      idempotencyKey: expect.any(String),
    });
    await act(async () => {
      await result.current.hook.reassign.mutateAsync({
        taskId: OTHER.id,
        assignee: { membershipId: 'mem_a' },
      });
    });
    expect(reassignTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: OTHER.id,
        assignee: { membershipId: 'mem_a' },
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('creates by hand, deletes with a reason (the row leaves at once) and restores', async () => {
    vi.mocked(addTask).mockResolvedValue(taskRecord({ kind: 'manual', ruleKey: null }));
    vi.mocked(deleteTask).mockReturnValue(new Promise(() => undefined));
    vi.mocked(restoreTask).mockResolvedValue(taskRecord());
    const { result } = await listed(() => ({
      create: useCreateTask(),
      remove: useDeleteTask(),
      restore: useRestoreTask(),
    }));
    const fields = {
      title: 'Call again · Anaya',
      why: null,
      dueAt: '2026-10-11T05:30:00.000Z',
      assignee: { membershipId: 'mem_a' },
      priority: 'normal' as const,
      contactId: null,
      link: null,
    };
    await act(async () => {
      await result.current.hook.create.mutateAsync({ fields });
    });
    expect(addTask).toHaveBeenCalledWith({ fields, idempotencyKey: expect.any(String) });

    act(() => {
      result.current.hook.remove.mutate({
        taskId: OTHER.id,
        reason: 'mistake',
        note: null,
      });
    });
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    expect(deleteTask).toHaveBeenCalledWith({
      taskId: OTHER.id,
      reason: 'mistake',
      note: null,
    });

    await act(async () => {
      await result.current.hook.restore.mutateAsync(OTHER.id);
    });
    expect(restoreTask).toHaveBeenCalledWith(OTHER.id, expect.any(String));
  });

  it('flips a rule switch at once and rolls it back when the save fails', async () => {
    vi.mocked(fetchTaskRuleSettings).mockResolvedValue({
      reply: { isOn: true, isAutomatic: false, canBeAutomatic: false, updatedAt: null },
    });
    let refuse!: (error: Error) => void;
    vi.mocked(saveTaskRuleSettings).mockReturnValue(
      new Promise((_resolve, reject) => {
        refuse = reject;
      }),
    );
    const { result } = renderHook(
      () => ({ settings: useTaskRuleSettings(), save: useSaveTaskRuleSettings() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.settings.data?.reply?.isOn).toBe(true));
    let saving: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = result.current.save
        .mutateAsync([{ ruleKey: 'reply', isOn: false }])
        .catch(() => undefined);
    });
    await waitFor(() => expect(result.current.settings.data?.reply?.isOn).toBe(false));
    await act(async () => {
      refuse(new Error('refused'));
      await saving;
    });
    await waitFor(() => expect(result.current.settings.data?.reply?.isOn).toBe(true));
  });
});
