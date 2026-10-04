import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TasksApiModule from '@/shared/api/clinic/tasks-api.ts';
import type { TaskDetail } from '@/shared/api/clinic/tasks-contracts.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';

import { taskRowFixture } from '../../__tests__/integration/task-row-fixture.ts';
import { type TaskActionsOptions, useTaskActions } from './useTaskActions.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { undo: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
const writes = vi.hoisted(() => ({ outcome: vi.fn(), hand: vi.fn() }));
vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof TasksApiModule>()),
  recordTaskOutcome: writes.outcome,
  handTaskToClinozy: writes.hand,
}));

const LEAD = '55555555-5555-4555-8555-555555555555';

function detailOf(overrides: Partial<TaskDetail['task']> = {}): TaskDetail {
  return {
    task: taskRowFixture(overrides),
    source: null,
    patient: null,
    thread: null,
    activity: [],
    quote: null,
    suggestion: null,
    staff: [],
  };
}

function setup() {
  const options: TaskActionsOptions = {
    assignees: { options: [], viewer: null, byId: new Map() },
    close: vi.fn(),
    openTarget: vi.fn(),
    openWhatsNext: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useTaskActions(options), { wrapper });
  return { result, options };
}

beforeEach(() => {
  for (const mock of [...Object.values(notifyMock), ...Object.values(writes)]) {
    mock.mockReset();
  }
});

describe('useTaskActions (KICKOFF §6.10 Outcome flow)', () => {
  it('opens the person’s record for "Fix the number" and writes nothing', () => {
    const { result, options } = setup();
    const detail = detailOf({
      rule: 'failed',
      person: { ...taskRowFixture().person, patientId: null, leadId: LEAD, kind: 'lead' },
    });
    act(() => result.current.recordOutcome(detail, 'fixTheNumber', ''));
    expect(options.openTarget).toHaveBeenCalledWith({ kind: 'lead', leadId: LEAD });
    expect(writes.outcome).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('leaves the drawer as it was when the write fails', async () => {
    writes.outcome.mockRejectedValue(new Error('connection dropped'));
    const { result, options } = setup();
    act(() => result.current.recordOutcome(detailOf(), 'confirmedOnCall', ''));
    await waitFor(() => expect(writes.outcome).toHaveBeenCalledOnce());
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(options.close).not.toHaveBeenCalled();
    expect(notifyMock.undo).not.toHaveBeenCalled();
  });

  it('ignores an outcome the rule does not have, and a hand-over a rule cannot take', () => {
    const { result } = setup();
    act(() => result.current.recordOutcome(detailOf(), 'nope', ''));
    act(() => result.current.handOver(taskRowFixture({ rule: 'manual' })));
    expect(writes.outcome).not.toHaveBeenCalled();
    expect(writes.hand).not.toHaveBeenCalled();
  });
});
