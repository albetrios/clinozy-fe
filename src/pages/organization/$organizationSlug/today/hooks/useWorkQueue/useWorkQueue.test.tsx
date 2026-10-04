import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as TasksApiModule from '@/shared/api/clinic/tasks-api.ts';
import { notify } from '@/shared/notify/index.ts';

import { useWorkQueue, type WorkQueueScope } from './useWorkQueue.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const gate = vi.hoisted(() => ({ refuse: false }));
vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TasksApiModule>();
  return {
    ...actual,
    recordTaskOutcome: async (...args: Parameters<typeof actual.recordTaskOutcome>) => {
      if (gate.refuse) throw new Error('connection dropped');
      return actual.recordTaskOutcome(...args);
    },
  };
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderQueue(scope: WorkQueueScope = 'mine') {
  const onFollowOn = vi.fn();
  const view = renderHook(() => useWorkQueue({ scope, onFollowOn }), { wrapper });
  return { ...view, onFollowOn };
}

const entryTitled = (entries: { row: { title: string } }[], title: string) =>
  entries.find((entry) => entry.row.title === title);

/** The Undo of the last undo toast. */
function lastUndo(): { message: string; onUndo: () => void } {
  const [message, options] = vi.mocked(notify.undo).mock.lastCall ?? [];
  if (!(message && options)) throw new Error('no undo toast');
  return { message, onUndo: options.onUndo };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  gate.refuse = false;
  for (const fn of Object.values(notify)) vi.mocked(fn).mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('useWorkQueue (KICKOFF §6.2 Work queue aside; Q-T3)', () => {
  it('keeps the member’s own tasks for Mine, by due time, and counts every open task', async () => {
    const { result } = renderQueue('mine');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries.every((entry) => entry.row.ownedByViewer)).toBe(true);
    expect(entryTitled(result.current.entries, 'Call Kabir back')).toBeUndefined();
    const due = result.current.entries.map((entry) => entry.row.dueAt);
    expect(due).toEqual([...due].sort());
    const open = clinicFixtures.tasks.snapshot((task) => task.status === 'open');
    expect(result.current.openCount).toBe(open.length);
  });

  it('shows every owner’s tasks for Everyone', async () => {
    const { result } = renderQueue('everyone');
    await waitFor(() =>
      expect(entryTitled(result.current.entries, 'Call Kabir back')).toBeDefined(),
    );
  });

  it('closes a task in place, toasts "<name>: <result>" with Undo, and opens its follow-on', async () => {
    const { result, onFollowOn } = renderQueue();
    await waitFor(() =>
      expect(entryTitled(result.current.entries, 'Rebook Vikram')).toBeDefined(),
    );
    const row = entryTitled(result.current.entries, 'Rebook Vikram')?.row;
    if (!row) throw new Error('no rebook task');
    act(() => result.current.record(row, 'rebooked'));
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    expect(lastUndo().message).toBe('Vikram Bhatt: Rebooked');
    expect(entryTitled(result.current.entries, 'Rebook Vikram')).toMatchObject({
      result: 'Rebooked',
      busy: false,
    });
    expect(onFollowOn).toHaveBeenCalledWith({
      kind: 'newAppointment',
      whoId: row.person.leadId,
      copyOf: ref.appointment(2862),
    });
    act(() => lastUndo().onUndo());
    await waitFor(() =>
      expect(entryTitled(result.current.entries, 'Rebook Vikram')?.result).toBeNull(),
    );
  });

  it('reads a snoozing outcome as its snooze, and keeps the card', async () => {
    const { result } = renderQueue();
    await waitFor(() =>
      expect(entryTitled(result.current.entries, 'Recall Tanvi')).toBeDefined(),
    );
    const row = entryTitled(result.current.entries, 'Recall Tanvi')?.row;
    if (!row) throw new Error('no recall task');
    act(() => result.current.record(row, 'later'));
    await waitFor(() => expect(notify.undo).toHaveBeenCalled());
    expect(lastUndo().message).toBe('Tanvi Shah: Snoozed · 7 days');
    await waitFor(() =>
      expect(entryTitled(result.current.entries, 'Recall Tanvi')?.result).toBe(
        'Snoozed · 7 days',
      ),
    );
  });

  it('leaves the card open when the write fails, and ignores an unknown outcome', async () => {
    gate.refuse = true;
    const { result } = renderQueue();
    await waitFor(() =>
      expect(entryTitled(result.current.entries, 'Recall Tanvi')).toBeDefined(),
    );
    const row = entryTitled(result.current.entries, 'Recall Tanvi')?.row;
    if (!row) throw new Error('no recall task');
    act(() => result.current.record(row, 'nope'));
    act(() => result.current.record(row, 'booked'));
    await waitFor(() => expect(notify.error).toHaveBeenCalled());
    expect(entryTitled(result.current.entries, 'Recall Tanvi')).toMatchObject({
      result: null,
      busy: false,
    });
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('opens the person’s record for an outcome that writes nothing', async () => {
    const { result, onFollowOn } = renderQueue('everyone');
    await waitFor(() =>
      expect(result.current.entries.some((entry) => entry.row.rule === 'failed')).toBe(
        true,
      ),
    );
    const row = result.current.entries.find((entry) => entry.row.rule === 'failed')?.row;
    if (!row) throw new Error('no failed-message task');
    act(() => result.current.record(row, 'fixTheNumber'));
    expect(onFollowOn).toHaveBeenCalledWith({ kind: 'lead', leadId: row.person.leadId });
    expect(notify.undo).not.toHaveBeenCalled();
  });
});
