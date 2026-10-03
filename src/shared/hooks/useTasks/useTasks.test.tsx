import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import {
  FIXTURE_VIEWER_ID,
  staffRef,
} from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { TASKS_REFETCH_MS } from '@/shared/api/clinic/tasks-contracts.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

import {
  useCreateTask,
  useHandTaskToClinozy,
  useReassignTask,
  useSaveTaskRuleSetting,
  useSnoozeTask,
  useTask,
  useTaskList,
  useTaskOutcome,
  useTaskRuleSettings,
  useUndoTaskChange,
} from './useTasks.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  vi.resetAllMocks();
  resetClinicFixtures();
});

const titleOf = (rows: readonly { title: string }[]) => rows.map((row) => row.title);

describe('useTaskList', () => {
  it('loads one view of the list and polls it every 60s', async () => {
    const { result } = renderHook(() => useTaskList({ scope: 'everyone' }), { wrapper });
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(5));
    expect(titleOf(result.current.rows)).toContain('Reply to Anaya');
    const query = client.getQueryCache().find({
      queryKey: taskQueryKeys.list({ scope: 'everyone' }),
    });
    expect(query?.observers[0]?.options.refetchInterval).toBe(TASKS_REFETCH_MS);
  });

  it('keys equal queries alike, whatever the order of the rule filter', async () => {
    const { result } = renderHook(
      () => ({
        one: useTaskList({ scope: 'everyone', type: ['reply', 'claim'] }),
        two: useTaskList({ type: ['claim', 'reply'], scope: 'everyone' }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.one.rows.length).toBeGreaterThan(0));
    expect(
      client.getQueryCache().findAll({ queryKey: taskQueryKeys.lists() }),
    ).toHaveLength(1);
  });
});

describe('useTask', () => {
  it('reads the drawer’s task and stays idle without an id', async () => {
    const { result: list } = renderHook(() => useTaskList({ scope: 'everyone' }), {
      wrapper,
    });
    await waitFor(() => expect(list.current.rows.length).toBeGreaterThan(0));
    const anaya = list.current.rows.find((row) => row.title === 'Reply to Anaya');
    const { result } = renderHook(() => useTask(anaya?.id), { wrapper });
    await waitFor(() => expect(result.current.data?.quote).toBe('Is Saturday possible?'));
    const { result: idle } = renderHook(() => useTask(null), { wrapper });
    expect(idle.current.fetchStatus).toBe('idle');
  });
});

describe('task writes', () => {
  async function listed() {
    const hook = renderHook(
      () => ({
        list: useTaskList({ scope: 'everyone' }),
        done: useTaskList({ scope: 'everyone', tab: 'done' }),
        outcome: useTaskOutcome(),
        undo: useUndoTaskChange(),
        snooze: useSnoozeTask(),
        reassign: useReassignTask(),
        create: useCreateTask(),
        clinozy: useHandTaskToClinozy(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(hook.result.current.list.rows.length).toBeGreaterThan(5));
    return hook;
  }
  const rowTitled = (rows: readonly { id: string; title: string }[], title: string) => {
    const row = rows.find((candidate) => candidate.title === title);
    if (!row) throw new Error(`no row "${title}"`);
    return row;
  };

  it('closes a task with an outcome — out of To do at once, into Done — and Undo brings it back', async () => {
    const { result } = await listed();
    const anaya = rowTitled(result.current.list.rows, 'Reply to Anaya');
    let token = '';
    await act(async () => {
      token = (
        await result.current.outcome.mutateAsync({
          taskId: anaya.id,
          outcome: 'notInterested',
        })
      ).undoToken;
    });
    await waitFor(() =>
      expect(titleOf(result.current.list.rows)).not.toContain('Reply to Anaya'),
    );
    await waitFor(() =>
      expect(titleOf(result.current.done.rows)).toContain('Reply to Anaya'),
    );
    await act(async () => {
      await result.current.undo.mutateAsync(token);
    });
    await waitFor(() =>
      expect(titleOf(result.current.list.rows)).toContain('Reply to Anaya'),
    );
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('keeps the row for "Fix the number" — nothing closes', async () => {
    const { result } = await listed();
    const failed = rowTitled(result.current.list.rows, 'Message to Kabir not delivered');
    await act(async () => {
      await result.current.outcome.mutateAsync({
        taskId: failed.id,
        outcome: 'fixTheNumber',
      });
    });
    expect(titleOf(result.current.list.rows)).toContain('Message to Kabir not delivered');
  });

  it('snoozes, reassigns, creates and hands a task to the automation', async () => {
    const { result } = await listed();
    const tanvi = rowTitled(result.current.list.rows, 'Recall Tanvi');
    const nirali = rowTitled(result.current.list.rows, 'Reply to Nirali');
    const rhea = rowTitled(result.current.list.rows, 'Reply to Rhea');
    await act(async () => {
      await result.current.snooze.mutateAsync({ taskId: tanvi.id, option: 'oneHour' });
      await result.current.reassign.mutateAsync({
        taskId: nirali.id,
        ownerId: staffRef('KP'),
      });
      await result.current.create.mutateAsync({
        title: 'Call again · Priti',
        ownerId: FIXTURE_VIEWER_ID,
        dueAt: clinicInstant('2026-10-03', '13:00'),
      });
      await result.current.clinozy.mutateAsync(rhea.id);
    });
    await waitFor(() => {
      const titles = titleOf(result.current.list.rows);
      expect(titles).not.toContain('Recall Tanvi');
      expect(titles).not.toContain('Reply to Rhea');
      expect(titles).toContain('Call again · Priti');
    });
    expect(rowTitled(result.current.list.rows, 'Reply to Nirali')).toMatchObject({
      ownerId: staffRef('KP'),
    });
  });

  it('toasts a refused write and puts the row back', async () => {
    const { result } = await listed();
    const anaya = rowTitled(result.current.list.rows, 'Reply to Anaya');
    await act(async () => {
      await result.current.outcome
        .mutateAsync({ taskId: anaya.id, outcome: 'claimIt' })
        .catch(() => undefined);
    });
    expect(notifyMock.error).toHaveBeenCalled();
    expect(titleOf(result.current.list.rows)).toContain('Reply to Anaya');
  });
});

describe('rule settings', () => {
  it('flips a rule at once and drops its tasks from the list', async () => {
    const { result } = renderHook(
      () => ({
        settings: useTaskRuleSettings(),
        save: useSaveTaskRuleSetting(),
        list: useTaskList({ scope: 'everyone' }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.settings.data?.reply.on).toBe(true));
    await waitFor(() =>
      expect(result.current.list.rows.some((row) => row.rule === 'reply')).toBe(true),
    );
    act(() => {
      result.current.save.mutate({ rule: 'reply', on: false });
    });
    await waitFor(() => expect(result.current.settings.data?.reply.on).toBe(false));
    await waitFor(() =>
      expect(result.current.list.rows.some((row) => row.rule === 'reply')).toBe(false),
    );
  });
});
