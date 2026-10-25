import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAccessFromCodes } from '@/shared/api/app/access-api.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import {
  reassignTask,
  recordTaskOutcome,
  snoozeTask,
} from '@/shared/api/app/tasks-api.ts';
import type { TaskDetail, TaskRow } from '@/shared/api/app/tasks-contracts.ts';
import { type BranchHours, DEFAULT_BRANCH_HOURS } from '@/shared/app/branch-hours.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { AppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  taskPerson,
  taskRecord,
  taskRow,
  TEST_TASK_CONTACT_ID,
  TEST_TASK_LEAD_ID,
} from '@/tests/utils/task-doubles.ts';

import type { TaskAssignees } from '../useTaskAssignees/index.ts';
import {
  type TaskActionsOptions,
  useTaskActions,
  WHATS_NEXT_DELAY_MS,
} from './useTaskActions.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { undo: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordTaskOutcome: vi.fn(),
  snoozeTask: vi.fn(),
  reassignTask: vi.fn(),
}));

/** Each branch's hours, by id — a branch not listed has the defaults (`useBranchHours`). */
const branchHours = vi.hoisted(() => new Map<string, BranchHours>());
vi.mock('@/shared/hooks/useBranchHours/index.ts', () => ({
  useBranchHours: () => (branchId: string | null) =>
    (branchId ? branchHours.get(branchId) : undefined) ?? DEFAULT_BRANCH_HOURS,
}));

/** The member's clinozy-be codes. */
const member = vi.hoisted(() => ({ codes: [] as string[] }));
vi.mock('@/shared/hooks/useAppAccess/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAppAccess: (): AppAccess => ({
    roles: [],
    previewRole: null,
    isResolved: true,
    ...resolveAccessFromCodes(member.codes),
    canCode: (code) => member.codes.includes(code),
  }),
}));

/** An Owner's codes in the drawer. */
const OWNER_CODES = [
  'task:read',
  'task:create',
  'task:update',
  'task:delete',
  'lead:read',
  'lead:update',
  'appointment:create',
  'appointment:update',
  'contact_activity:create',
  'contact_activity:update',
  'patient:update',
];

/** 10:30 in the clinic on Sat 10 Oct 2026 — the screen's clock. */
const NOW = new Date('2026-10-10T05:00:00.000Z');

const ASHA: DirectoryMember = {
  id: 'mem_asha0000000000000000',
  userId: 'usr_asha',
  name: 'Asha Mehta',
  initials: 'AM',
  tone: 'sage',
  roleIds: [],
  branchIds: [],
};

const ASSIGNEES: TaskAssignees = {
  options: [],
  myMembershipId: 'mem_yls33gz5jj66ful8q4ads',
  byId: new Map([[ASHA.id, ASHA]]),
  isPending: false,
};

function detailOf(
  task: TaskRow = taskRow(),
  patch: Partial<TaskDetail> = {},
): TaskDetail {
  return { task, source: null, quote: null, ...patch };
}

/** A confirm task for Priti's visit, in the member's hands. */
const confirmTask = () =>
  taskRow({
    id: 'task_confirmpriti0000000',
    type: 'confirm',
    ruleKey: 'confirm',
    title: 'Confirm Priti’s visit',
    link: { kind: 'appointment', id: 'apt_priti00000000000000' },
    person: taskPerson({
      id: 'con_priti00000000000000',
      name: 'Priti Soni',
      firstName: 'Priti',
    }),
  });

function setup() {
  const options: TaskActionsOptions = {
    assignees: ASSIGNEES,
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
  member.codes = [...OWNER_CODES];
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  vi.mocked(recordTaskOutcome).mockReset();
  vi.mocked(snoozeTask).mockReset();
  vi.mocked(reassignTask).mockReset();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useTaskActions — outcomes (KICKOFF §6.10 Outcome flow)', () => {
  it('runs the outcome’s plan with its words and the screen’s clock, toasts it and asks what’s next', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const task = confirmTask();
    vi.mocked(recordTaskOutcome).mockResolvedValue(
      taskRecord({
        ...task,
        status: 'done',
        outcome: 'done',
        resultText: 'Confirmed on call',
      }),
    );
    const { result, options } = setup();

    act(() =>
      result.current.recordOutcome(detailOf(task), {
        outcomeId: 'confirmedOnCall',
        note: '  Spoke to her mother ',
        now: NOW,
      }),
    );
    await vi.waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    expect(recordTaskOutcome).toHaveBeenCalledWith({
      task,
      outcomeId: 'confirmedOnCall',
      words: 'Confirmed on call',
      note: 'Spoke to her mother',
      now: NOW.toISOString(),
      hours: DEFAULT_BRANCH_HOURS,
      failedActivityId: null,
      idempotencyKey: expect.any(String),
    });
    // No Undo: the API has no way back for an outcome (research-tasks Q7).
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Confirm Priti’s visit · Confirmed on call',
    );
    expect(notifyMock.undo).not.toHaveBeenCalled();
    expect(options.openWhatsNext).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(WHATS_NEXT_DELAY_MS));
    expect(options.openWhatsNext).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: task.id, status: 'done', person: task.person }),
      result: 'Confirmed on call',
    });
  });

  it('opens the follow-on screen instead — a booking for the person', async () => {
    vi.mocked(recordTaskOutcome).mockResolvedValue(
      taskRecord({ status: 'done', outcome: 'done', resultText: 'Booked a visit' }),
    );
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(), {
        outcomeId: 'bookedVisit',
        note: '',
        now: NOW,
      }),
    );
    await waitFor(() =>
      expect(options.openTarget).toHaveBeenCalledWith({
        kind: 'newAppointment',
        whoId: TEST_TASK_CONTACT_ID,
      }),
    );
    expect(vi.mocked(recordTaskOutcome).mock.lastCall?.[0]).toMatchObject({ note: null });
    expect(options.close).not.toHaveBeenCalled();
  });

  it('says "Snoozed · No answer" when the server snoozes a no-answer — and asks nothing next', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const task = confirmTask();
    vi.mocked(recordTaskOutcome).mockResolvedValue(
      taskRecord({ ...task, status: 'snoozed', snoozeLabel: 'No answer' }),
    );
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(task), {
        outcomeId: 'noAnswer',
        note: '',
        now: NOW,
      }),
    );
    await vi.waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    expect(notifyMock.success).toHaveBeenCalledWith('Snoozed · No answer');
    act(() => vi.advanceTimersByTime(WHATS_NEXT_DELAY_MS));
    expect(options.openWhatsNext).not.toHaveBeenCalled();
  });

  it('asks nothing next of a member who may not create tasks', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    member.codes = OWNER_CODES.filter((code) => code !== 'task:create');
    const task = confirmTask();
    vi.mocked(recordTaskOutcome).mockResolvedValue(
      taskRecord({ ...task, status: 'done', resultText: 'Confirmed on call' }),
    );
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(task), {
        outcomeId: 'confirmedOnCall',
        note: '',
        now: NOW,
      }),
    );
    await vi.waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    act(() => vi.advanceTimersByTime(WHATS_NEXT_DELAY_MS));
    expect(options.openWhatsNext).not.toHaveBeenCalled();
  });

  it('resends the undelivered message the drawer quoted', async () => {
    const task = taskRow({
      type: 'failed_message',
      ruleKey: 'failed_message',
      link: null,
    });
    vi.mocked(recordTaskOutcome).mockResolvedValue(taskRecord({ status: 'done' }));
    const { result } = setup();
    act(() =>
      result.current.recordOutcome(
        detailOf(task, {
          quote: {
            activityId: 'act_failed000000000000',
            text: 'Hi',
            at: NOW.toISOString(),
          },
        }),
        { outcomeId: 'retrySend', note: '', now: NOW },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(recordTaskOutcome).mock.lastCall?.[0]).toMatchObject({
        words: 'Retry send',
        failedActivityId: 'act_failed000000000000',
      }),
    );
  });

  it('writes nothing for "Fix the number": it opens the person’s record', async () => {
    const task = taskRow({
      type: 'failed_message',
      ruleKey: 'failed_message',
      link: null,
    });
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(task), {
        outcomeId: 'fixTheNumber',
        note: '',
        now: NOW,
      }),
    );
    expect(options.openTarget).toHaveBeenCalledWith({
      kind: 'lead',
      leadId: TEST_TASK_LEAD_ID,
    });
    expect(recordTaskOutcome).not.toHaveBeenCalled();
  });

  it('claims the lead: "You now own <lead>"', async () => {
    const task = taskRow({ type: 'claim', ruleKey: 'claim', title: 'Claim Anaya' });
    vi.mocked(recordTaskOutcome).mockResolvedValue(taskRecord({ status: 'done' }));
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(task), {
        outcomeId: 'claimIt',
        note: '',
        now: NOW,
      }),
    );
    await waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringContaining('You now own Anaya Desai'),
    );
  });

  it('tells a claim without Leads edit in the room’s words (403 missing_permission)', async () => {
    const task = taskRow({ type: 'claim', ruleKey: 'claim' });
    vi.mocked(recordTaskOutcome).mockRejectedValue(refusal(403, 'missing_permission'));
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(task), {
        outcomeId: 'claimIt',
        note: '',
        now: NOW,
      }),
    );
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Claiming a lead needs Leads edit access — ask an Owner or Admin',
      ),
    );
    expect(options.close).not.toHaveBeenCalled();
  });

  it('says the task is already closed (409 transition_not_allowed) and leaves the drawer', async () => {
    vi.mocked(recordTaskOutcome).mockRejectedValue(
      refusal(409, 'transition_not_allowed'),
    );
    const { result, options } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(confirmTask()), {
        outcomeId: 'confirmedOnCall',
        note: '',
        now: NOW,
      }),
    );
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith('This task is already closed'),
    );
    expect(notifyMock.error).not.toHaveBeenCalled();
    expect(options.close).not.toHaveBeenCalled();
  });

  it('toasts any other refusal in the server’s words', async () => {
    vi.mocked(recordTaskOutcome).mockRejectedValue(refusal(400, 'outcome'));
    const { result } = setup();
    act(() =>
      result.current.recordOutcome(detailOf(confirmTask()), {
        outcomeId: 'confirmedOnCall',
        note: '',
        now: NOW,
      }),
    );
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith('server: outcome'));
  });
});

describe('useTaskActions — snooze and reassign', () => {
  it('snoozes from the screen’s clock with the option’s words, toasts it and closes', async () => {
    vi.mocked(snoozeTask).mockResolvedValue(
      taskRecord({ status: 'snoozed', snoozeLabel: '1 hour' }),
    );
    const { result, options } = setup();
    act(() => result.current.snooze(taskRow(), 'oneHour', NOW));
    await waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    expect(snoozeTask).toHaveBeenCalledWith({
      taskId: taskRow().id,
      until: '2026-10-10T06:00:00.000Z',
      label: '1 hour',
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Snoozed · 1 hour');
  });

  it('snoozes "Tomorrow" to the task’s branch’s next opening, and says when', async () => {
    // NOW is Saturday 10 Oct, 10:30 in the clinic; this branch is closed Sunday and Monday.
    branchHours.set('brn_vesu', {
      opensAt: '11:30',
      closesAt: '19:00',
      workingDays: ['tue', 'wed', 'thu', 'fri', 'sat'],
    });
    vi.mocked(snoozeTask).mockImplementation(async ({ label }) =>
      taskRecord({ status: 'snoozed', snoozeLabel: label }),
    );
    const { result, options } = setup();
    act(() => result.current.snooze(taskRow({ branchId: 'brn_vesu' }), 'tomorrow', NOW));
    await waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    expect(snoozeTask).toHaveBeenCalledWith({
      taskId: taskRow().id,
      until: appInstant('2026-10-13', '11:30'),
      label: expect.stringMatching(/Oct.*13.*11:30/u),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Snoozed · .*Oct.*13.*11:30/u),
    );
    branchHours.clear();
  });

  it('snoozes "Tomorrow" in the default hours for a task of no known branch', async () => {
    vi.mocked(snoozeTask).mockResolvedValue(taskRecord({ status: 'snoozed' }));
    const { result, options } = setup();
    act(() => result.current.snooze(taskRow({ branchId: null }), 'tomorrow', NOW));
    await waitFor(() => expect(options.close).toHaveBeenCalledOnce());
    // Sunday is closed by default: Monday at 10:00.
    expect(vi.mocked(snoozeTask).mock.calls[0]?.[0].until).toBe(
      appInstant('2026-10-12', '10:00'),
    );
  });

  it('gives the task to a member or a role’s queue, and keeps the drawer', async () => {
    vi.mocked(reassignTask).mockResolvedValue(taskRecord({ ownerId: ASHA.id }));
    const { result, options } = setup();
    act(() => result.current.reassign(taskRow(), { membershipId: ASHA.id }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        expect.stringContaining('Reply to Anaya → Asha M.'),
      ),
    );
    act(() => result.current.reassign(taskRow(), { role: 'counsellor' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenLastCalledWith(
        expect.stringContaining('Reply to Anaya → Counsellor'),
      ),
    );
    expect(reassignTask).toHaveBeenLastCalledWith({
      taskId: taskRow().id,
      assignee: { role: 'counsellor' },
      idempotencyKey: expect.any(String),
    });
    expect(options.close).not.toHaveBeenCalled();
  });

  it('writes nothing when the task is already there', () => {
    const { result } = setup();
    act(() => result.current.reassign(taskRow(), { role: 'front_desk' }));
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it('tells a lead’s task moved without Leads edit in the room’s words (403 missing_permission)', async () => {
    vi.mocked(reassignTask).mockRejectedValue(refusal(403, 'missing_permission'));
    const { result } = setup();
    act(() => result.current.reassign(taskRow(), { membershipId: ASHA.id }));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Moving a lead’s task needs Leads edit access — ask an Owner or Admin',
      ),
    );
  });
});
