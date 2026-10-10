import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type * as TasksApiModule from '@/shared/api/clinic/tasks-api.ts';
import {
  countOpenTasks,
  listTasks,
  recordTaskOutcome,
  type TaskPage,
} from '@/shared/api/clinic/tasks-api.ts';
import type {
  TaskListQueryInput,
  TaskRecord,
  TaskRow,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { PRITI_VISIT_ID, taskRowFixture } from '@/tests/utils/task-row-fixture.ts';

import {
  useWorkQueue,
  type WorkQueueEntry,
  type WorkQueueScope,
} from './useWorkQueue.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TasksApiModule>()),
  listTasks: vi.fn(),
  countOpenTasks: vi.fn(),
  recordTaskOutcome: vi.fn(),
}));

/** Priti's confirm task, due 10:50 — and a rebook task due earlier, and Asha's call-back. */
const CONFIRM = taskRowFixture();
const REBOOK = taskRowFixture({
  id: 'task_rebook0000000000000000',
  ruleKey: 'rebook',
  type: 'rebook',
  title: 'Rebook Vikram',
  dueAt: '2026-10-04T04:15:00.000Z',
});
const DONE = taskRowFixture({
  id: 'task_done00000000000000000',
  title: 'Confirm Meera’s visit',
  status: 'done',
  resultText: 'Confirmed on call',
  resolvedAt: '2026-10-04T04:00:00.000Z',
  dueAt: '2026-10-04T04:30:00.000Z',
});
const BY_CLINOZY = taskRowFixture({
  id: 'task_clinozy0000000000000',
  title: 'Confirm Rohan’s visit',
  status: 'done',
  resultText: `Done by ${PRODUCT_NAME}`,
  isResolvedAutomatically: true,
  dueAt: '2026-10-04T06:00:00.000Z',
});

/** The server's pages per view: To do in two pages, today's Done in one. */
function serve({ open = [REBOOK, CONFIRM], done = [DONE, BY_CLINOZY] } = {}) {
  vi.mocked(listTasks).mockImplementation(
    async (query: TaskListQueryInput, after?: string): Promise<TaskPage> => {
      if (query.tab === 'done') return { rows: done, next: null, total: done.length };
      if (after === 'second') return { rows: open.slice(1), next: null, total: null };
      return { rows: open.slice(0, 1), next: 'second', total: open.length };
    },
  );
  vi.mocked(countOpenTasks).mockResolvedValue(9);
}

/** The task after a resolve or a snooze. */
const taskAfter = (row: TaskRow, patch: Partial<TaskRecord>): TaskRecord => ({
  ...row,
  ...patch,
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderQueue(scope: WorkQueueScope = 'mine', enabled = true) {
  const onFollowOn = vi.fn();
  const view = renderHook(() => useWorkQueue({ scope, enabled, onFollowOn }), {
    wrapper,
  });
  return { ...view, onFollowOn };
}

const titles = (entries: { row: { title: string } }[]) =>
  entries.map((entry) => entry.row.title);
const entryOf = (entries: readonly WorkQueueEntry[], id: string) =>
  entries.find((entry) => entry.row.id === id);

const refusal = (status: number, reason: string) =>
  new HttpError('Refused', status, '/api/v1/app/tasks', 'POST', {
    error: {
      type: 'request_error',
      code: 'refused',
      reason,
      detail: `server: ${reason}`,
    },
  });

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  signInTestMember();
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  vi.mocked(listTasks).mockReset();
  vi.mocked(countOpenTasks).mockReset();
  vi.mocked(recordTaskOutcome).mockReset();
  serve();
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useWorkQueue (KICKOFF §6.2 Work queue aside; Q-T3) on clinozy-be', () => {
  it('reads To do and today’s Done for the scope in the header’s branches, every page, by due time', async () => {
    const { result } = renderQueue('mine');
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.entries).toHaveLength(4));
    expect(
      vi.mocked(listTasks).mock.calls.map(([query, cursor]) => [query, cursor]),
    ).toEqual(
      expect.arrayContaining([
        [{ tab: 'open', scope: 'mine', branchIds: [] }, undefined],
        [{ tab: 'open', scope: 'mine', branchIds: [] }, 'second'],
        [{ tab: 'done', scope: 'mine', branchIds: [] }, undefined],
      ]),
    );
    expect(titles(result.current.entries)).toEqual([
      'Rebook Vikram',
      'Confirm Meera’s visit',
      'Confirm Priti’s visit',
      'Confirm Rohan’s visit',
    ]);
    // A member's close shows its words; the server's own close none ("Done by Clinozy" is its due label).
    expect(entryOf(result.current.entries, DONE.id)?.result).toBe('Confirmed on call');
    expect(entryOf(result.current.entries, BY_CLINOZY.id)?.result).toBe('');
    expect(entryOf(result.current.entries, CONFIRM.id)?.result).toBeNull();
    // "<n> open" is every open task, whoever owns it.
    expect(countOpenTasks).toHaveBeenCalledWith([]);
    expect(result.current.openCount).toBe(9);
  });

  it('asks the server for everyone’s tasks under Everyone', async () => {
    const { result } = renderQueue('everyone');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listTasks).toHaveBeenCalledWith(
      { tab: 'open', scope: 'everyone', branchIds: [] },
      undefined,
    );
  });

  it('reads nothing for a member who does not read tasks', async () => {
    const { result } = renderQueue('mine', false);
    expect(result.current.loading).toBe(false);
    expect(result.current.entries).toEqual([]);
    await act(() => Promise.resolve());
    expect(listTasks).not.toHaveBeenCalled();
    expect(countOpenTasks).not.toHaveBeenCalled();
  });

  it('closes a task in place with its result and toasts "<name>: <result>" — no Undo', async () => {
    vi.mocked(recordTaskOutcome).mockImplementation(async () => {
      serve({ open: [REBOOK], done: [DONE, BY_CLINOZY] });
      return taskAfter(CONFIRM, {
        status: 'done',
        resultText: 'Confirmed on call',
        resolvedAt: '2026-10-04T05:12:00.000Z',
      });
    });
    const { result, onFollowOn } = renderQueue();
    await waitFor(() =>
      expect(entryOf(result.current.entries, CONFIRM.id)).toBeDefined(),
    );
    act(() => result.current.record(CONFIRM, 'confirmedOnCall'));
    await waitFor(() => expect(notify.success).toHaveBeenCalled());
    expect(recordTaskOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        task: CONFIRM,
        outcomeId: 'confirmedOnCall',
        words: 'Confirmed on call',
        note: null,
        failedActivityId: null,
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Priti Soni: Confirmed on call');
    expect(notify.undo).not.toHaveBeenCalled();
    expect(entryOf(result.current.entries, CONFIRM.id)).toMatchObject({
      result: 'Confirmed on call',
      busy: false,
    });
    expect(onFollowOn).not.toHaveBeenCalled();
  });

  it('reads an outcome the server snoozed as its snooze, and keeps the card', async () => {
    vi.mocked(recordTaskOutcome).mockResolvedValue(
      taskAfter(CONFIRM, { status: 'snoozed', snoozeLabel: 'No answer' }),
    );
    const { result } = renderQueue();
    await waitFor(() =>
      expect(entryOf(result.current.entries, CONFIRM.id)).toBeDefined(),
    );
    act(() => result.current.record(CONFIRM, 'noAnswer'));
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Priti Soni: Snoozed · No answer'),
    );
    expect(entryOf(result.current.entries, CONFIRM.id)?.result).toBe(
      'Snoozed · No answer',
    );
  });

  it('opens a booking for the person (by their contact) after an outcome that books', async () => {
    vi.mocked(recordTaskOutcome).mockResolvedValue(
      taskAfter(REBOOK, { status: 'done', resultText: 'Rebooked' }),
    );
    const { result, onFollowOn } = renderQueue();
    await waitFor(() => expect(entryOf(result.current.entries, REBOOK.id)).toBeDefined());
    act(() => result.current.record(REBOOK, 'rebooked'));
    await waitFor(() =>
      expect(onFollowOn).toHaveBeenCalledWith({
        kind: 'newAppointment',
        whoId: REBOOK.person?.id,
        copyOf: PRITI_VISIT_ID,
      }),
    );
    expect(notify.success).toHaveBeenCalledWith('Priti Soni: Rebooked');
  });

  it('says a task closed first in the room’s words, reads the queue again, and reopens the card', async () => {
    vi.mocked(recordTaskOutcome).mockRejectedValue(
      refusal(409, 'transition_not_allowed'),
    );
    const { result } = renderQueue();
    await waitFor(() =>
      expect(entryOf(result.current.entries, CONFIRM.id)).toBeDefined(),
    );
    const reads = vi.mocked(listTasks).mock.calls.length;
    act(() => result.current.record(CONFIRM, 'confirmedOnCall'));
    await waitFor(() =>
      expect(notify.info).toHaveBeenCalledWith('This task is already closed'),
    );
    await waitFor(() =>
      expect(vi.mocked(listTasks).mock.calls.length).toBeGreaterThan(reads),
    );
    expect(notify.success).not.toHaveBeenCalled();
    expect(entryOf(result.current.entries, CONFIRM.id)).toMatchObject({
      result: null,
      busy: false,
    });
  });

  it('toasts any other refusal in the server’s words, and ignores an unknown outcome', async () => {
    vi.mocked(recordTaskOutcome).mockRejectedValue(refusal(403, 'missing_permission'));
    const { result } = renderQueue();
    await waitFor(() =>
      expect(entryOf(result.current.entries, CONFIRM.id)).toBeDefined(),
    );
    act(() => result.current.record(CONFIRM, 'nope'));
    expect(recordTaskOutcome).not.toHaveBeenCalled();
    act(() => result.current.record(CONFIRM, 'confirmedOnCall'));
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    expect(entryOf(result.current.entries, CONFIRM.id)).toMatchObject({
      result: null,
      busy: false,
    });
  });

  it('opens the person’s record for an outcome that writes nothing', async () => {
    const failed = taskRowFixture({
      id: 'task_failed0000000000000000',
      ruleKey: 'failed_message',
      type: 'failed_message',
      link: null,
    });
    serve({ open: [failed], done: [] });
    const { result, onFollowOn } = renderQueue('everyone');
    await waitFor(() => expect(entryOf(result.current.entries, failed.id)).toBeDefined());
    act(() => result.current.record(failed, 'fixTheNumber'));
    expect(onFollowOn).toHaveBeenCalledWith({
      kind: 'patient',
      patientId: failed.person?.patientId,
      section: 'timeline',
    });
    expect(recordTaskOutcome).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });
});
