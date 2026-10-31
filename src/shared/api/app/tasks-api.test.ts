import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('./contacts-api.ts', () => ({
  fetchContact: vi.fn(),
  fetchContactsByIds: vi.fn(),
}));
vi.mock('./leads-api.ts', () => ({ fetchLead: vi.fn(), updateLead: vi.fn() }));
vi.mock('./appointments-api.ts', () => ({
  fetchAppointment: vi.fn(),
  moveAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));
vi.mock('./contact-activities-api.ts', () => ({
  sendContactActivity: vi.fn(),
  resendContactActivity: vi.fn(),
}));
vi.mock('./feedback-api.ts', () => ({ fetchCheckIn: vi.fn(), fetchReview: vi.fn() }));
vi.mock('./treatments-api.ts', () => ({ fetchTreatment: vi.fn() }));
import { api } from '@/core/http/api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import {
  taskContactWireRow,
  taskRow,
  taskWireRow,
  TEST_TASK_ID,
  TEST_TASK_LEAD_ID,
} from '@/tests/utils/task-doubles.ts';

import { appInstant } from './app-time.ts';
import {
  cancelAppointment,
  fetchAppointment,
  moveAppointment,
} from './appointments-api.ts';
import type { AppointmentRow } from './appointments-contracts.ts';
import { resendContactActivity, sendContactActivity } from './contact-activities-api.ts';
import { fetchContact, fetchContactsByIds } from './contacts-api.ts';
import { toContact, toContactProfile, toContactSummary } from './contacts-contracts.ts';
import { fetchLead, updateLead } from './leads-api.ts';
import type { LeadRecord } from './leads-contracts.ts';
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
} from './tasks-api.ts';

const KEY = 'act_1';
const CONTACT_ID = 'con_8hb15isod6txlpljrn1f7';
/** 10:00 in the clinic on Sat 10 Oct 2026. */
const NOW = appInstant('2026-10-10', '10:00');

/** An answer with a task, as `api.get/post` resolve it. */
const answer = (data: unknown, meta: unknown = { request_id: 'req' }) =>
  ({ data, meta }) as never;

/** A refusal as the fetch client throws it. */
const refusal = (status: number, reason: string) =>
  new HttpError('refused', status, '/api/v1/app/tasks', 'POST', {
    error: { reason, detail: 'refused' },
  });

const anaya = () => {
  const row = taskContactWireRow();
  return { ...toContactSummary(row as never), ...toContactProfile(row as never) };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('taskQueryKeys', () => {
  it('keep the tasks’ prefix the other rooms refresh, then the organization', () => {
    expect(taskQueryKeys.all).toEqual(['app', 'tasks']);
    expect(
      taskQueryKeys.list('org_1', { type: ['confirm', 'reply'], scope: 'mine' }),
    ).toEqual(taskQueryKeys.list('org_1', { type: ['reply', 'confirm'] }));
    expect(taskQueryKeys.detail('org_1', TEST_TASK_ID)).toEqual([
      'app',
      'tasks',
      'org_1',
      'detail',
      TEST_TASK_ID,
    ]);
  });
});

describe('listTasks', () => {
  it('reads a page for the view, scope, types and search, each row with its person', async () => {
    vi.mocked(api.get).mockResolvedValue(
      answer([taskWireRow()], {
        request_id: 'req',
        pagination: { per_page: 50, next: 'cur_2', has_more: true, estimated_total: 61 },
      }),
    );
    vi.mocked(fetchContactsByIds).mockResolvedValue(new Map([[CONTACT_ID, anaya()]]));

    const page = await listTasks(
      { tab: 'open', scope: 'everyone', type: ['by_hand', 'reply'], q: ' Anaya ' },
      'cur_1',
    );

    expect(api.get).toHaveBeenCalledWith('/app/tasks', {
      query: {
        limit: 50,
        tab: 'open',
        scope: 'everyone',
        rule_key: 'reply',
        kind: 'follow_up,manual',
        q: 'Anaya',
        after: 'cur_1',
      },
    });
    expect(fetchContactsByIds).toHaveBeenCalledWith([CONTACT_ID]);
    expect(page.next).toBe('cur_2');
    expect(page.total).toBe(61);
    expect(page.rows[0]).toMatchObject({
      id: TEST_TASK_ID,
      type: 'reply',
      person: { firstName: 'Anaya', contactNumber: 9, openLeadId: TEST_TASK_LEAD_ID },
    });
  });

  it('defaults to my To do and ends on the last page', async () => {
    vi.mocked(api.get).mockResolvedValue(
      answer([], { request_id: 'req', pagination: { next: null, has_more: false } }),
    );
    vi.mocked(fetchContactsByIds).mockResolvedValue(new Map());
    const page = await listTasks({});
    expect(vi.mocked(api.get).mock.calls[0]?.[1]).toEqual({
      query: { limit: 50, tab: 'open', scope: 'mine', q: undefined, after: undefined },
    });
    expect(page).toEqual({ rows: [], next: null, total: null });
  });

  it('counts every open task for Today (T4)', async () => {
    vi.mocked(api.get).mockResolvedValue(
      answer([taskWireRow()], { request_id: 'req', pagination: { estimated_total: 12 } }),
    );
    await expect(countOpenTasks()).resolves.toBe(12);
    expect(api.get).toHaveBeenCalledWith('/app/tasks', {
      query: { tab: 'open', scope: 'everyone', limit: 1 },
    });
  });

  it('counts the open tasks in the header’s branches when it names any', async () => {
    vi.mocked(api.get).mockResolvedValue(
      answer([], { request_id: 'req', pagination: { estimated_total: 4 } }),
    );
    await expect(countOpenTasks(['brn_a', 'brn_b'])).resolves.toBe(4);
    expect(api.get).toHaveBeenCalledWith('/app/tasks', {
      query: { tab: 'open', scope: 'everyone', limit: 1, branch_id: 'brn_a,brn_b' },
    });
  });
});

describe('fetchTask', () => {
  const lead = { id: TEST_TASK_LEAD_ID } as LeadRecord;

  function readsTask(patch: Record<string, unknown> = {}) {
    vi.mocked(api.get).mockImplementation(async (path) => {
      if (path === '/app/tasks/{task_id}') return answer(taskWireRow(patch));
      return answer([
        {
          id: 'msg_1',
          body: 'Is Saturday possible?',
          occurred_at: '2026-10-09T20:01:53.787Z',
        },
      ]);
    });
    vi.mocked(fetchContact).mockResolvedValue(
      toContact({ ...taskContactWireRow(), phones: [] } as never),
    );
  }

  it('reads the task, its person, its lead and the message it quotes — each once', async () => {
    readsTask();
    vi.mocked(fetchLead).mockResolvedValue(lead);
    const detail = await fetchTask(TEST_TASK_ID, () => true);
    expect(detail.task.person?.openLeadId).toBe(TEST_TASK_LEAD_ID);
    expect(detail.source).toEqual({ kind: 'lead', lead });
    expect(detail.quote).toEqual({
      activityId: 'msg_1',
      text: 'Is Saturday possible?',
      at: '2026-10-09T20:01:53.787Z',
    });
    expect(api.get).toHaveBeenCalledWith('/app/contacts/{contact_id}/activities', {
      params: { contact_id: CONTACT_ID },
      query: {
        direction: 'received',
        type: 'whatsapp,instagram',
        order: 'desc',
        limit: 1,
      },
    });
  });

  it('leaves out what the member may not read — by code, or by a 403 or 404', async () => {
    readsTask();
    const detail = await fetchTask(TEST_TASK_ID, (code) => code === 'task:read');
    expect(detail).toMatchObject({ source: null, quote: null });
    expect(fetchLead).not.toHaveBeenCalled();

    readsTask({ rule_key: 'confirm', lead_id: null, appointment_id: 'appt_1' });
    vi.mocked(fetchAppointment).mockRejectedValue(
      new HttpError('gone', 404, '/api/v1/app/appointments/appt_1', 'GET'),
    );
    await expect(fetchTask(TEST_TASK_ID, () => true)).resolves.toMatchObject({
      source: null,
      quote: null,
    });

    vi.mocked(fetchAppointment).mockRejectedValue(new Error('connection dropped'));
    await expect(fetchTask(TEST_TASK_ID, () => true)).rejects.toThrow(
      'connection dropped',
    );
  });

  it('reads the appointment of a visit task', async () => {
    readsTask({ rule_key: 'confirm', lead_id: null, appointment_id: 'appt_1' });
    const visit = { id: 'appt_1' } as AppointmentRow;
    vi.mocked(fetchAppointment).mockResolvedValue(visit);
    const detail = await fetchTask(TEST_TASK_ID, () => true);
    expect(detail.source).toEqual({ kind: 'appointment', appointment: visit });
  });
});

describe('recordTaskOutcome (research-tasks §2.1)', () => {
  const base = {
    note: null,
    now: NOW,
    failedActivityId: null,
    idempotencyKey: KEY,
  };

  beforeEach(() => {
    vi.mocked(api.post).mockResolvedValue(
      answer(
        taskWireRow({ status: 'done', outcome: 'done', result_text: 'Not interested' }),
      ),
    );
  });

  it('writes the lead, then resolves with the outcome, the words and the note', async () => {
    const task = await recordTaskOutcome({
      ...base,
      task: taskRow(),
      outcomeId: 'notInterested',
      words: 'Not interested',
      note: '  Went elsewhere ',
    });
    expect(updateLead).toHaveBeenCalledWith({
      leadId: TEST_TASK_LEAD_ID,
      fields: { status: 'not_interested' },
      idempotencyKey: `${KEY}:leadStatus`,
    });
    expect(api.post).toHaveBeenCalledWith('/app/tasks/{task_id}/resolve', {
      params: { task_id: TEST_TASK_ID },
      body: { outcome: 'done', result_text: 'Not interested', note: 'Went elsewhere' },
      idempotencyKey: `${KEY}:resolve`,
    });
    expect(task?.status).toBe('done');
  });

  it('logs the call before a "No answer" — the server snoozes it', async () => {
    await recordTaskOutcome({
      ...base,
      task: taskRow({ ruleKey: 'follow_up', type: 'follow_up' }),
      outcomeId: 'noAnswer',
      words: 'No answer',
    });
    expect(sendContactActivity).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      channel: 'call',
      body: 'No answer',
      idempotencyKey: `${KEY}:logCall`,
    });
    expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({
      body: { outcome: 'no_answer' },
    });
  });

  it('No answer moves the lead to No response, the next try tomorrow at the task’s clock (D25)', async () => {
    await recordTaskOutcome({
      ...base,
      task: taskRow({
        ruleKey: 'follow_up',
        type: 'follow_up',
        dueAt: appInstant('2026-10-10', '18:00'),
      }),
      outcomeId: 'noAnswer',
      words: 'No answer',
    });
    expect(updateLead).toHaveBeenCalledWith({
      leadId: TEST_TASK_LEAD_ID,
      fields: { status: 'no_response', followUpAt: appInstant('2026-10-11', '18:00') },
      idempotencyKey: `${KEY}:leadNoAnswer`,
    });
  });

  it('confirms the visit — and a resolve the rules beat counts as done (T7)', async () => {
    const visitTask = taskRow({
      ruleKey: 'confirm',
      type: 'confirm',
      link: { kind: 'appointment', id: 'appt_1' },
    });
    vi.mocked(api.post).mockRejectedValue(refusal(409, 'transition_not_allowed'));
    vi.mocked(api.get).mockResolvedValue(
      answer(taskWireRow({ status: 'done', is_resolved_automatically: true })),
    );
    const task = await recordTaskOutcome({
      ...base,
      task: visitTask,
      outcomeId: 'confirmedOnCall',
      words: 'Confirmed on call',
    });
    expect(moveAppointment).toHaveBeenCalledWith({
      appointmentId: 'appt_1',
      route: 'confirm',
      idempotencyKey: `${KEY}:appointment`,
    });
    expect(task?.isResolvedAutomatically).toBe(true);
  });

  it('cancels for the patient; refuses a closed task when it wrote nothing first', async () => {
    const visitTask = taskRow({
      ruleKey: 'confirm',
      type: 'confirm',
      link: { kind: 'appointment', id: 'appt_1' },
    });
    await recordTaskOutcome({
      ...base,
      task: visitTask,
      outcomeId: 'cancelledByPatient',
      words: 'Cancelled by patient',
    });
    expect(cancelAppointment).toHaveBeenCalledWith({
      appointmentId: 'appt_1',
      cancel: { reason: 'patient_asked', note: null },
      idempotencyKey: `${KEY}:appointment`,
    });

    vi.mocked(api.post).mockRejectedValue(refusal(409, 'transition_not_allowed'));
    await expect(
      recordTaskOutcome({
        ...base,
        task: visitTask,
        outcomeId: 'moveToAnotherSlot',
        words: 'Move to another slot',
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('stops at a record write that fails — the task stays', async () => {
    vi.mocked(updateLead).mockRejectedValue(refusal(403, 'missing_permission'));
    await expect(
      recordTaskOutcome({
        ...base,
        task: taskRow(),
        outcomeId: 'spamOrWrongNumber',
        words: 'Spam',
      }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('snoozes "Running late" 30 minutes from when it was chosen, with its words', async () => {
    await recordTaskOutcome({
      ...base,
      task: taskRow({ ruleKey: 'arrive', type: 'arrive' }),
      outcomeId: 'runningLate',
      words: 'Running late',
    });
    expect(api.post).toHaveBeenCalledWith('/app/tasks/{task_id}/snooze', {
      params: { task_id: TEST_TASK_ID },
      body: {
        snoozed_until: new Date(Date.parse(NOW) + 30 * 60_000).toISOString(),
        snooze_label: 'Running late',
      },
      idempotencyKey: `${KEY}:snooze`,
    });
  });

  it('resends the quoted message, or reads the newest undelivered one', async () => {
    const failed = taskRow({
      ruleKey: 'failed_message',
      type: 'failed_message',
      link: null,
    });
    await recordTaskOutcome({
      ...base,
      task: failed,
      outcomeId: 'retrySend',
      words: 'Retry send',
      failedActivityId: 'msg_failed',
    });
    expect(resendContactActivity).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      activityId: 'msg_failed',
      idempotencyKey: `${KEY}:resendFailedMessage`,
    });

    vi.mocked(api.get).mockResolvedValue(
      answer([{ id: 'msg_newest', body: 'Hi', occurred_at: NOW }]),
    );
    await recordTaskOutcome({
      ...base,
      task: failed,
      outcomeId: 'retrySend',
      words: 'Retry send',
    });
    expect(api.get).toHaveBeenCalledWith('/app/contacts/{contact_id}/activities', {
      params: { contact_id: CONTACT_ID },
      query: { delivery_status: 'failed', order: 'desc', limit: 1 },
    });
    expect(resendContactActivity).toHaveBeenLastCalledWith({
      contactId: CONTACT_ID,
      activityId: 'msg_newest',
      idempotencyKey: `${KEY}:resendFailedMessage`,
    });
  });

  it('sets the patient’s follow-up two weeks out', async () => {
    await recordTaskOutcome({
      ...base,
      task: taskRow({
        ruleKey: 'next_visit',
        type: 'next_visit',
        link: null,
        person: { ...taskRow().person!, patientId: 'pat_9e6j52vjb8uhvz44ebe94' },
      }),
      outcomeId: 'setFollowUpDate',
      words: 'Set follow-up date',
    });
    expect(api.patch).toHaveBeenCalledWith('/app/patients/{patient_id}', {
      params: { patient_id: 'pat_9e6j52vjb8uhvz44ebe94' },
      body: { follow_up_at: appInstant('2026-10-24', '11:00') },
      idempotencyKey: `${KEY}:patientFollowUp`,
    });
  });

  it('writes nothing for "Fix the number", and refuses an outcome the type lacks', async () => {
    await expect(
      recordTaskOutcome({
        ...base,
        task: taskRow({ ruleKey: 'failed_message', type: 'failed_message' }),
        outcomeId: 'fixTheNumber',
        words: 'Fix the number',
      }),
    ).resolves.toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    await expect(
      recordTaskOutcome({ ...base, task: taskRow(), outcomeId: 'claimIt', words: 'x' }),
    ).rejects.toThrow('no outcome');
  });
});

describe('the task’s own writes', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockResolvedValue(answer(taskWireRow()));
  });

  it('snoozes until an instant with its words, or none', async () => {
    await snoozeTask({
      taskId: TEST_TASK_ID,
      until: '2026-10-11T04:30:00.000Z',
      label: '  ',
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/tasks/{task_id}/snooze', {
      params: { task_id: TEST_TASK_ID },
      body: { snoozed_until: '2026-10-11T04:30:00.000Z', snooze_label: undefined },
      idempotencyKey: KEY,
    });
  });

  it('moves a task to a member or a role’s queue', async () => {
    await reassignTask({
      taskId: TEST_TASK_ID,
      assignee: { role: 'counsellor' },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/tasks/{task_id}/reassign', {
      params: { task_id: TEST_TASK_ID },
      body: { owner_role: 'counsellor' },
      idempotencyKey: KEY,
    });
  });

  it('adds a task by hand, deletes it with a reason and restores it', async () => {
    const created = await addTask({
      fields: {
        title: 'Call again · Anaya',
        why: null,
        dueAt: '2026-10-11T05:30:00.000Z',
        assignee: { membershipId: 'mem_yls33gz5jj66ful8q4ads' },
        priority: 'normal',
        contactId: CONTACT_ID,
        link: { kind: 'lead', id: TEST_TASK_LEAD_ID },
      },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/tasks', {
      body: {
        title: 'Call again · Anaya',
        due_at: '2026-10-11T05:30:00.000Z',
        owner_membership_id: 'mem_yls33gz5jj66ful8q4ads',
        contact_id: CONTACT_ID,
        lead_id: TEST_TASK_LEAD_ID,
        priority: 'normal',
      },
      idempotencyKey: KEY,
    });
    expect(created.id).toBe(TEST_TASK_ID);

    await deleteTask({ taskId: TEST_TASK_ID, reason: 'mistake', note: null });
    expect(api.delete).toHaveBeenCalledWith('/app/tasks/{task_id}', {
      params: { task_id: TEST_TASK_ID },
      reason: 'mistake',
      note: undefined,
    });

    await restoreTask(TEST_TASK_ID, KEY);
    expect(api.post).toHaveBeenLastCalledWith('/app/tasks/{task_id}/restore', {
      params: { task_id: TEST_TASK_ID },
      idempotencyKey: KEY,
    });
  });
});

describe('the rules and who can work tasks', () => {
  const setting = (rule: string, patch: Record<string, unknown> = {}) => ({
    id: null,
    rule_key: rule,
    is_on: true,
    is_automatic: false,
    can_be_automatic: rule === 'confirm',
    updated_at: null,
    ...patch,
  });

  it('reads every rule’s setting and saves the switches that moved', async () => {
    vi.mocked(api.get).mockResolvedValue(answer([setting('reply'), setting('confirm')]));
    const settings = await fetchTaskRuleSettings();
    expect(settings.confirm?.canBeAutomatic).toBe(true);
    expect(settings.reply?.isOn).toBe(true);

    vi.mocked(api.put).mockResolvedValue(
      answer([setting('confirm', { is_automatic: true })]),
    );
    const saved = await saveTaskRuleSettings({
      changes: [{ ruleKey: 'confirm', isAutomatic: true }],
      idempotencyKey: KEY,
    });
    expect(api.put).toHaveBeenCalledWith('/app/task-rule-settings', {
      body: { rules: [{ rule_key: 'confirm', is_automatic: true }] },
      idempotencyKey: KEY,
    });
    expect(saved.confirm?.isAutomatic).toBe(true);
  });

  it('reads the members who hold `task:read`, every page (D81 T8)', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        answer([{ id: 'mem_a' }], {
          request_id: 'req',
          pagination: { next: 'cur_2', has_more: true },
        }),
      )
      .mockResolvedValueOnce(
        answer([{ id: 'mem_b' }], { request_id: 'req', pagination: { next: null } }),
      );
    await expect(fetchTaskWorkerIds()).resolves.toEqual(['mem_a', 'mem_b']);
    expect(api.get).toHaveBeenNthCalledWith(1, '/app/memberships', {
      query: { holds: 'task:read', include_ended: 'false', limit: 100, after: undefined },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/memberships', {
      query: { holds: 'task:read', include_ended: 'false', limit: 100, after: 'cur_2' },
    });
  });
});
