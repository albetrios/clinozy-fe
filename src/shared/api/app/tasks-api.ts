import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { apiErrorReason } from '@/shared/errors/errorHandler.ts';
import { isHttpError, isNotFound } from '@/shared/errors/HttpError.ts';

import type { DeleteReason } from './app-schema.ts';
import { addCivilDays, appInstant, appToday } from './app-time.ts';
import {
  cancelAppointment,
  fetchAppointment,
  moveAppointment,
} from './appointments-api.ts';
import { resendContactActivity, sendContactActivity } from './contact-activities-api.ts';
import { fetchContact, fetchContactsByIds } from './contacts-api.ts';
import { fetchCheckIn, fetchReview } from './feedback-api.ts';
import { fetchLead, updateLead } from './leads-api.ts';
import {
  findTaskOutcome,
  normalizeTaskListQuery,
  type TaskAppointmentAction,
  type TaskAssignee,
  taskCreateBodyOf,
  type TaskDetail,
  type TaskFields,
  type TaskLinkKind,
  type TaskListQueryInput,
  taskNoteOf,
  type TaskOutcomeCode,
  type TaskOutcomeStep,
  taskOwnerBodyOf,
  type TaskQuote,
  type TaskRecord,
  taskResultTextOf,
  type TaskRow,
  taskRowWire,
  type TaskRuleKey,
  type TaskRuleSettingChange,
  type TaskRuleSettings,
  taskRuleSettingsBodyOf,
  taskRuleSettingWire,
  taskSnoozeLabelOf,
  type TaskSourceRecord,
  taskTimeAfter,
  taskTypeQueryOf,
  taskWire,
  toTaskPerson,
  toTaskRecord,
  toTaskRow,
  toTaskRuleSettings,
} from './tasks-contracts.ts';
import { fetchTreatment } from './treatments-api.ts';

/*
 * The Tasks domain on clinozy-be (`/app/tasks`, `/app/task-rule-settings`): the list, each page
 * joined with its people (`GET /app/contacts?ids=`); one task with the record it points at and
 * the message it quotes; an outcome — its record writes, then the task's own resolve or snooze;
 * snooze, reassign, create, delete and restore; the rule switches; and who can work tasks (the
 * assignee pickers, `GET /app/memberships?holds=task:read`). Every write carries the action's key.
 */

/** TanStack Query keys for the tasks, each carrying the organization. */
export const taskQueryKeys = {
  /** Every task read — the other rooms' writes refresh them by this prefix. */
  all: ['app', 'tasks'] as const,
  /** Every list variant — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...taskQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, query: TaskListQueryInput = {}) =>
    [...taskQueryKeys.lists(organizationId), normalizeTaskListQuery(query)] as const,
  /** "<n> open" — every open task, whoever owns it, in the header's branches. */
  openCount: (organizationId: string | null, branchIds: readonly string[] = []) =>
    [...taskQueryKeys.all, organizationId, 'open-count', [...branchIds]] as const,
  details: (organizationId: string | null) =>
    [...taskQueryKeys.all, organizationId, 'detail'] as const,
  detail: (organizationId: string | null, taskId: string) =>
    [...taskQueryKeys.details(organizationId), taskId] as const,
  ruleSettings: (organizationId: string | null) =>
    [...taskQueryKeys.all, organizationId, 'rule-settings'] as const,
  /** The members who can work tasks — the assignee pickers. */
  workers: (organizationId: string | null) =>
    [...taskQueryKeys.all, organizationId, 'workers'] as const,
};

/**
 * The other records a task outcome can change — the lead, the person's stream, the person, the
 * booking, the patient file (and its check-ins) — by the `['app', <domain>]` key prefix each
 * room keeps its queries under.
 */
export const TASK_SIDE_EFFECT_KEYS = [
  ['app', 'leads'],
  ['app', 'messages'],
  ['app', 'contacts'],
  ['app', 'appointments'],
  ['app', 'patients'],
] as const;

/** One page of the list — the design's 50. */
const PAGE_SIZE = 50;

/** One page of a cursor list: its rows, the next cursor, the first page's estimated total. */
export interface TaskPage {
  rows: TaskRow[];
  next: string | null;
  total: number | null;
}

/** The list read's query for a list query. */
export function taskListQuery(input: TaskListQueryInput) {
  const query = normalizeTaskListQuery(input);
  return {
    limit: PAGE_SIZE,
    tab: query.tab,
    scope: query.scope,
    ...taskTypeQueryOf(query.type),
    q: query.q === '' ? undefined : query.q,
    branch_id: query.branchIds?.join(','),
  };
}

/** One page of tasks for a list query, each with its person; `after` is the cursor. */
export async function listTasks(
  query: TaskListQueryInput,
  after?: string,
): Promise<TaskPage> {
  const response = await api.get('/app/tasks', {
    query: { ...taskListQuery(query), after },
  });
  const tasks = z
    .array(taskRowWire)
    .parse(response.data ?? [])
    .map(toTaskRecord);
  const people = await fetchContactsByIds(
    tasks.flatMap((task) => (task.contact ? [task.contact.id] : [])),
  );
  const pagination = response.meta?.pagination;
  return {
    rows: tasks.map((task) => toTaskRow(task, people)),
    ...pageOf(pagination),
  };
}

/**
 * How many tasks are open, whoever owns them — Today's "<n> open" (research-tasks T4) — in the
 * header's branches (and those under none) when it names any.
 */
export async function countOpenTasks(branchIds: readonly string[] = []): Promise<number> {
  const response = await api.get('/app/tasks', {
    query: {
      tab: 'open',
      scope: 'everyone',
      limit: 1,
      ...(branchIds.length > 0 ? { branch_id: branchIds.join(',') } : {}),
    },
  });
  return response.meta?.pagination?.estimated_total ?? response.data?.length ?? 0;
}

/** Whether a read was refused or found nothing — what a drawer leaves out instead of failing. */
const isUnreadable = (error: unknown) =>
  isNotFound(error) || (isHttpError(error) && error.status === 403);

/** A read the drawer can do without — `undefined` when the member may not read it or it is gone. */
async function optional<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if (isUnreadable(error)) return undefined;
    throw error;
  }
}

/** Whether the member holds a permission code. */
type CanRead = (code: string) => boolean;

/** How the drawer reads each kind of record a task points at: its read code, the read. */
interface SourceRead {
  code: string;
  /** Records on the patient file are read under the person's patient file. */
  needsPatient: boolean;
  read: (id: string, patientId: string) => Promise<TaskSourceRecord>;
}

/**
 * The records the drawer reads by link. A bill or a credit (Payments is on fixtures) and a medical
 * rep (Medical is parked) are named by kind only.
 */
const SOURCE_READS: Partial<Record<TaskLinkKind, SourceRead>> = {
  lead: {
    code: 'lead:read',
    needsPatient: false,
    read: async (id) => ({ kind: 'lead', lead: await fetchLead(id) }),
  },
  appointment: {
    code: 'appointment:read',
    needsPatient: false,
    read: async (id) => ({
      kind: 'appointment',
      appointment: await fetchAppointment(id),
    }),
  },
  treatment: {
    code: 'patient_treatment:read',
    needsPatient: true,
    read: async (id, patientId) => ({
      kind: 'treatment',
      treatment: await fetchTreatment(patientId, id),
    }),
  },
  checkIn: {
    code: 'patient:read',
    needsPatient: true,
    read: async (id, patientId) => ({
      kind: 'checkIn',
      checkIn: await fetchCheckIn(patientId, id),
    }),
  },
  review: {
    code: 'patient:read',
    needsPatient: true,
    read: async (id, patientId) => ({
      kind: 'review',
      review: await fetchReview(patientId, id),
    }),
  },
};

/**
 * The record a task points at, read once by its link — only where the member holds its read code
 * (a tile they can't read is left out, research-tasks T2).
 */
async function readSource(
  task: TaskRow,
  canRead: CanRead,
): Promise<TaskSourceRecord | undefined> {
  const source = task.link ? SOURCE_READS[task.link.kind] : undefined;
  if (!(task.link && source && canRead(source.code))) return undefined;
  const patientId = task.person?.patientId ?? '';
  if (source.needsPatient && !patientId) return undefined;
  return source.read(task.link.id, patientId);
}

type ApiActivity = NonNullable<
  ApiData<'/app/contacts/{contact_id}/activities', 'get'>
>[number];

const quotedActivityWire = wireSchema<ApiActivity>()(
  z.object({ id: z.string(), body: z.string(), occurred_at: z.string() }),
);

/** What each quoting rule reads of the person's stream: their latest message in, or the undelivered one. */
const QUOTE_QUERIES: Partial<
  Record<
    TaskRuleKey,
    { direction?: 'received'; type?: string; delivery_status?: 'failed' }
  >
> = {
  reply: { direction: 'received', type: 'whatsapp,instagram' },
  failed_message: { delivery_status: 'failed' },
};

/** The person's newest activity matching a quote query, or none. */
async function readActivity(
  contactId: string,
  query: NonNullable<(typeof QUOTE_QUERIES)[TaskRuleKey]>,
): Promise<TaskQuote | null> {
  const response = await api.get('/app/contacts/{contact_id}/activities', {
    params: { contact_id: contactId },
    query: { ...query, order: 'desc', limit: 1 },
  });
  const [row] = z.array(quotedActivityWire).parse(response.data ?? []);
  return row ? { activityId: row.id, text: row.body, at: row.occurred_at } : null;
}

/** The message a reply or a failed-message task quotes (one read per drawer, research-tasks T3). */
async function readQuote(task: TaskRow, canRead: CanRead): Promise<TaskQuote | null> {
  const query = task.ruleKey ? QUOTE_QUERIES[task.ruleKey] : undefined;
  if (!(query && task.contact && canRead('contact_activity:read'))) return null;
  return readActivity(task.contact.id, query);
}

/**
 * One task for its drawer — a 404 when it is gone or in a branch the member cannot see: the task
 * with its person (one contact read), the record it points at and the message it quotes, each
 * read once and only where `canRead` holds the read's code.
 */
export async function fetchTask(taskId: string, canRead: CanRead): Promise<TaskDetail> {
  const response = await api.get('/app/tasks/{task_id}', {
    params: { task_id: taskId },
  });
  const record = toTaskRecord(taskWire.parse(response.data));
  const contact = record.contact;
  const person = contact
    ? toTaskPerson(contact, await optional(() => fetchContact(contact.id)))
    : null;
  const task: TaskRow = { ...record, person };
  const [source, quote] = await Promise.all([
    optional(() => readSource(task, canRead)),
    optional(() => readQuote(task, canRead)),
  ]);
  return { task, source: source ?? null, quote: quote ?? null };
}

// ── An outcome ──

/** What an outcome write sends. */
export interface TaskOutcomeInput {
  /** The task as read — its link, its person and their patient file. */
  task: TaskRow;
  /** The outcome's id in the task's type ({@link findTaskOutcome}). */
  outcomeId: string;
  /** The outcome's words in the member's language — the result, the call note, the snooze label. */
  words: string;
  note: string | null;
  /** When the member chose it — the times it sets count from here, so a retry sends the same. */
  now: string;
  /** The undelivered message the drawer quoted, for "Retry send" (read again when null). */
  failedActivityId: string | null;
}

/** What one record write reads. */
interface StepContext {
  task: TaskRow;
  words: string;
  today: string;
  idempotencyKey: string;
}

/** The lead a task points at. */
const leadIdOf = (task: TaskRecord) => (task.link?.kind === 'lead' ? task.link.id : null);

/** The booking a task points at. */
const appointmentIdOf = (task: TaskRecord) =>
  task.link?.kind === 'appointment' ? task.link.id : null;

/** The route of each status move. */
const APPOINTMENT_MOVES = {
  confirm: 'confirm',
  checkIn: 'check-in',
  noShow: 'no-show',
} as const satisfies Record<Exclude<TaskAppointmentAction, 'cancel'>, string>;

async function moveTaskAppointment(
  action: TaskAppointmentAction,
  { task, idempotencyKey }: StepContext,
): Promise<void> {
  const appointmentId = appointmentIdOf(task);
  if (!appointmentId) return;
  if (action === 'cancel') {
    await cancelAppointment({
      appointmentId,
      cancel: { reason: 'patient_asked', note: null },
      idempotencyKey,
    });
    return;
  }
  await moveAppointment({
    appointmentId,
    route: APPOINTMENT_MOVES[action],
    idempotencyKey,
  });
}

/** The person's newest undelivered message, queued again. */
async function resendFailedMessage(
  failedActivityId: string | null,
  { task, idempotencyKey }: StepContext,
): Promise<void> {
  const contactId = task.contact?.id;
  if (!contactId) return;
  const activityId =
    failedActivityId ??
    (await readActivity(contactId, { delivery_status: 'failed' }))?.activityId;
  if (!activityId) return;
  await resendContactActivity({ contactId, activityId, idempotencyKey });
}

/** One record write of an outcome; a write with nothing to point at is skipped. */
async function runStep(
  step: TaskOutcomeStep,
  at: StepContext,
  failedActivityId: string | null,
): Promise<void> {
  const leadId = leadIdOf(at.task);
  const contactId = at.task.contact?.id;
  const patientId = at.task.person?.patientId;
  switch (step.type) {
    case 'leadStatus':
      if (!leadId) return;
      await updateLead({
        leadId,
        fields: { status: step.status },
        idempotencyKey: at.idempotencyKey,
      });
      return;
    case 'leadFollowUpTomorrow':
      if (!leadId) return;
      await updateLead({
        leadId,
        fields: { followUpAt: appInstant(addCivilDays(at.today, 1), step.at) },
        idempotencyKey: at.idempotencyKey,
      });
      return;
    case 'logCall':
      if (!contactId) return;
      await sendContactActivity({
        contactId,
        channel: 'call',
        body: at.words,
        idempotencyKey: at.idempotencyKey,
      });
      return;
    case 'resendFailedMessage':
      await resendFailedMessage(failedActivityId, at);
      return;
    case 'appointment':
      await moveTaskAppointment(step.action, at);
      return;
    case 'patientFollowUp':
      if (!patientId) return;
      await api.patch('/app/patients/{patient_id}', {
        params: { patient_id: patientId },
        body: { follow_up_at: appInstant(addCivilDays(at.today, step.days), '11:00') },
        idempotencyKey: at.idempotencyKey,
      });
      return;
  }
}

/** The task's resolve — a close the server's rules made first counts as done. */
async function resolveTask(
  input: TaskOutcomeInput,
  outcome: TaskOutcomeCode,
  { wroteRecords, idempotencyKey }: { wroteRecords: boolean; idempotencyKey: string },
): Promise<TaskRecord> {
  try {
    const response = await api.post('/app/tasks/{task_id}/resolve', {
      params: { task_id: input.task.id },
      body: {
        outcome,
        result_text: taskResultTextOf(input.words),
        note: taskNoteOf(input.note),
      },
      idempotencyKey,
    });
    return toTaskRecord(taskWire.parse(response.data));
  } catch (error) {
    // The record write ran the rules, and they closed the task before this resolve (T7).
    if (!(wroteRecords && apiErrorReason(error) === 'transition_not_allowed'))
      throw error;
    return fetchTaskRecord(input.task.id);
  }
}

/** One task, alone. */
async function fetchTaskRecord(taskId: string): Promise<TaskRecord> {
  const response = await api.get('/app/tasks/{task_id}', {
    params: { task_id: taskId },
  });
  return toTaskRecord(taskWire.parse(response.data));
}

/**
 * Record one of a task's outcomes (research-tasks §2.1): its record writes in order — each with
 * its own key from the action's — then the task's own write: a resolve with its code, the words
 * and the note, or a snooze for its span. A record write that fails stops it; the task stays.
 * Answers the task after, or null for an outcome that writes nothing ("Fix the number").
 */
export async function recordTaskOutcome({
  idempotencyKey,
  ...input
}: TaskOutcomeInput & { idempotencyKey: string }): Promise<TaskRecord | null> {
  const plan = findTaskOutcome(input.task.type, input.outcomeId);
  if (!plan)
    throw new Error(`tasks: no outcome "${input.outcomeId}" on ${input.task.type}`);
  const now = new Date(input.now);
  const at: Omit<StepContext, 'idempotencyKey'> = {
    task: input.task,
    words: input.words,
    today: appToday(now),
  };
  for (const step of plan.steps) {
    await runStep(
      step,
      { ...at, idempotencyKey: `${idempotencyKey}:${step.type}` },
      input.failedActivityId,
    );
  }
  const { write } = plan;
  if (write.type === 'resolve') {
    return resolveTask(input, write.outcome, {
      wroteRecords: plan.steps.length > 0,
      idempotencyKey: `${idempotencyKey}:resolve`,
    });
  }
  if (write.type === 'snooze') {
    return snoozeTask({
      taskId: input.task.id,
      until: taskTimeAfter(write.span, now),
      label: input.words,
      idempotencyKey: `${idempotencyKey}:snooze`,
    });
  }
  return null;
}

// ── The task's own writes ──

/** Snooze a task until an instant (in the future), with the words its row shows. */
export async function snoozeTask({
  taskId,
  until,
  label,
  idempotencyKey,
}: {
  taskId: string;
  until: string;
  label: string | null;
  idempotencyKey: string;
}): Promise<TaskRecord> {
  const response = await api.post('/app/tasks/{task_id}/snooze', {
    params: { task_id: taskId },
    body: { snoozed_until: until, snooze_label: taskSnoozeLabelOf(label) },
    idempotencyKey,
  });
  return toTaskRecord(taskWire.parse(response.data));
}

/**
 * Move a task to a member or a role's queue — a lead's task moves its lead too, and needs
 * `lead:update` (`403 missing_permission`, D81 TASKS-M3); a member who can't work tasks is a `400`.
 */
export async function reassignTask({
  taskId,
  assignee,
  idempotencyKey,
}: {
  taskId: string;
  assignee: TaskAssignee;
  idempotencyKey: string;
}): Promise<TaskRecord> {
  const response = await api.post('/app/tasks/{task_id}/reassign', {
    params: { task_id: taskId },
    body: taskOwnerBodyOf(assignee),
    idempotencyKey,
  });
  return toTaskRecord(taskWire.parse(response.data));
}

/**
 * A task made by hand — New task, or "What’s next" (kind `manual`, its branch the record's). A
 * rule's task is never made here.
 */
export async function addTask({
  fields,
  idempotencyKey,
}: {
  fields: TaskFields;
  idempotencyKey: string;
}): Promise<TaskRecord> {
  const response = await api.post('/app/tasks', {
    body: taskCreateBodyOf(fields),
    idempotencyKey,
  });
  return toTaskRecord(taskWire.parse(response.data));
}

/** Delete a task made by hand with the reason (a rule's task is `409 rule_task`). */
export async function deleteTask({
  taskId,
  reason,
  note,
}: {
  taskId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/tasks/{task_id}', {
    params: { task_id: taskId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted task back. */
export async function restoreTask(
  taskId: string,
  idempotencyKey: string,
): Promise<TaskRecord> {
  const response = await api.post('/app/tasks/{task_id}/restore', {
    params: { task_id: taskId },
    idempotencyKey,
  });
  return toTaskRecord(taskWire.parse(response.data));
}

// ── The rules ──

/** Every rule's setting: on, handed to Clinozy, and whether Clinozy can do it. */
export async function fetchTaskRuleSettings(): Promise<TaskRuleSettings> {
  const response = await api.get('/app/task-rule-settings');
  return toTaskRuleSettings(z.array(taskRuleSettingWire).parse(response.data ?? []));
}

/**
 * Switch rules on or off, or hand them to Clinozy (`organization:update`); answers every rule's.
 * Handing over a rule Clinozy can't do is a `400` on `rules/<n>/is_automatic`.
 */
export async function saveTaskRuleSettings({
  changes,
  idempotencyKey,
}: {
  changes: readonly TaskRuleSettingChange[];
  idempotencyKey: string;
}): Promise<TaskRuleSettings> {
  const response = await api.put('/app/task-rule-settings', {
    body: taskRuleSettingsBodyOf(changes),
    idempotencyKey,
  });
  return toTaskRuleSettings(z.array(taskRuleSettingWire).parse(response.data ?? []));
}

// ── Who can work tasks ──

type ApiMemberPick = NonNullable<ApiData<'/app/memberships', 'get'>>[number];

const memberIdWire = wireSchema<ApiMemberPick>()(z.object({ id: z.string() }));

/** The permission code a task's owner must hold (`400` "cannot work tasks" otherwise). */
const TASK_WORKER_CODE = 'task:read';

/**
 * The active members who can work tasks — they hold `task:read` (D81 T8,
 * `GET /app/memberships?holds=`), every page; the assignee pickers offer only them.
 */
export async function fetchTaskWorkerIds(): Promise<string[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/memberships', {
      query: {
        holds: TASK_WORKER_CODE,
        include_ended: 'false',
        limit: 100,
        after: after ?? undefined,
      },
    });
    return {
      rows: z.array(memberIdWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'task-workers');
  return rows.map((row) => row.id);
}
