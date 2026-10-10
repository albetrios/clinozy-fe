import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type { AppointmentRecord } from '@/shared/api/clinic/appointments-fixture-contracts.ts';
import { fixtureUuid } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import {
  clinicHttpError,
  type CreateInput,
  FIXTURE_ACTOR_ID,
  FIXTURE_ORGANIZATION_ID,
  type FixtureChange,
  recordFixtureChange,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import type {
  Invoice,
  LeadMessage,
  Patient,
  Treatment,
  User,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  addCivilDays,
  clinicInstant,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-fixture-contracts.ts';
import { LEAD_HOLD_DAYS } from '@/shared/api/clinic/leads-fixture-hold.ts';
import {
  type CreateTaskInput,
  createTaskInputSchema,
  findTaskOutcome,
  MANUAL_TASK_TYPE_KINDS,
  type ReassignTaskInput,
  reassignTaskInputSchema,
  type RecordTaskOutcomeInput,
  recordTaskOutcomeInputSchema,
  type SaveTaskRuleSettingInput,
  saveTaskRuleSettingInputSchema,
  type SnoozeTaskInput,
  snoozeTaskInputSchema,
  TASK_CLINOZY_OUTCOME,
  TASK_RULE_IDS,
  TASK_RULES,
  TASK_SNOOZE_SPANS,
  type TaskChange,
  type TaskDetail,
  type TaskListQuery,
  taskListQuerySchema,
  type TaskOutcomeEffect,
  taskOutcomeKey,
  type TaskPerson,
  type TaskRecord,
  type TaskRow,
  type TaskRuleOutcome,
  type TaskRuleSettings,
  type TaskSourceRecord,
  type TaskSourceRef,
  type TaskStaff,
  taskTimeAfter,
} from '@/shared/api/clinic/tasks-contracts.ts';
import type { ListPage } from '@/shared/api/fetch-list-page.ts';

import { writeAppointmentStatus } from './appointment-status.fixtures.ts';
import { findPersonThread } from './contact-threads.fixtures.ts';
import { systemLine } from './messages.fixtures.ts';
import { FIXTURE_VIEWER_ID } from './staff.fixtures.ts';
import {
  clockLabel,
  CONFIRMED_BY_WHATSAPP_RESULT,
  dayLabel,
  deriveRuleTasks,
  interestLabel,
  type OutcomeServerText,
  type OutcomeTextContext,
  planTaskRuleSync,
  staffShortName,
  suggestedMessage,
  TASK_AUTOMATION_TEXT,
  TASK_OUTCOME_TEXT,
  TASK_SNOOZE_LABELS,
  taskClosedLine,
  taskMovedLine,
  type TaskRuleMatch,
  unhappyTaskText,
} from './task-rules.fixtures.ts';
import { clinicFixtures, onClinicFixturesReset } from './world.fixtures.ts';

/**
 * The Tasks fixture server (REPLACE_WITH_API: `listTasks`, `getTask`,
 * `createTask`, `resolveTask`, S:1718–1729, plus Appendix F's snooze, reassign,
 * "Let Clinozy do it", rule settings and Undo). Every read and write first
 * runs the rule job (Q-T3), the way clinozy-be keeps its rule tasks current.
 * `tasks-api.ts` loads this module on demand; when the API lands, it goes.
 */

/** The WhatsApp-confirmed visits the Done view lists (H:4270: "up to 4"). */
const CONFIRMED_ENTRIES_MAX = 4;

const defaultRuleSettings = (): TaskRuleSettings =>
  Object.fromEntries(
    TASK_RULE_IDS.map((rule) => [rule, { on: true, handled: false }]),
  ) as TaskRuleSettings;

let ruleSettings = defaultRuleSettings();
const undoLog = new Map<string, FixtureChange>();

onClinicFixturesReset(() => {
  ruleSettings = defaultRuleSettings();
  undoLog.clear();
});

/** A task as it starts: open, unresolved, no rule match, no history. */
const OPEN_TASK = {
  status: 'open',
  snoozedUntil: null,
  outcome: null,
  resolvedAt: null,
  ruleKey: null,
  ruleOutcome: null,
  result: null,
  note: null,
  resolvedBy: null,
  resolvedById: null,
  snoozeLabel: null,
  previousOwnerIds: [],
  manualType: null,
  priority: 'normal',
  remindMinutesBefore: null,
} as const satisfies Partial<TaskRecord>;

// ── The rule job ──

function recordOfMatch(found: TaskRuleMatch): CreateInput<TaskRecord> {
  return { ...OPEN_TASK, ...found, ownerRole: null };
}

/**
 * A rule task's id, from its rule key — the rule and the record it matched —
 * so the job names the same task the same on every load: a reload or a shared
 * `/tasks/<id>` link finds it again (the world reseeds on every page load).
 */
const ruleTaskId = (ruleKey: string) => fixtureUuid('rule-task', ruleKey);

/**
 * Bring the stored tasks up to the rules: wake snoozes that ran out, close the
 * derived tasks whose record changed ("Done by Clinozy"), create the new
 * ones. Inside a write, `change` records it so that write's Undo reverses it —
 * the appointments server runs it after every booking write, so a status's
 * tasks (a no-show's Rebook) come and go with the status.
 */
export async function syncTaskRules(
  now: Date,
  change: FixtureChange = recordFixtureChange(),
): Promise<void> {
  const tasks = clinicFixtures.tasks;
  const plan = planTaskRuleSync(
    tasks.snapshot(),
    deriveRuleTasks({
      now,
      viewerId: FIXTURE_VIEWER_ID,
      holdDays: LEAD_HOLD_DAYS,
      staff: clinicFixtures.staff.snapshot(),
      patients: clinicFixtures.patients.snapshot(),
      leads: clinicFixtures.leads.snapshot(),
      messages: clinicFixtures.leadMessages.snapshot(),
      appointments: clinicFixtures.appointments.snapshot(),
      treatments: clinicFixtures.treatments.snapshot(),
      checkIns: clinicFixtures.checkIns.snapshot(),
      packages: clinicFixtures.patientPackages.snapshot(),
    }),
    now,
  );
  for (const id of plan.wake) {
    await change.update(tasks, id, {
      status: 'open',
      snoozedUntil: null,
      snoozeLabel: null,
      outcome: null,
      ruleOutcome: null,
    });
  }
  for (const { id, result } of plan.close) {
    await change.update(tasks, id, {
      status: 'done',
      outcome: 'done',
      ruleOutcome: null,
      result,
      resolvedAt: now.toISOString(),
      resolvedBy: 'clinozy',
      resolvedById: null,
      snoozedUntil: null,
      snoozeLabel: null,
    });
  }
  for (const found of plan.create) {
    const id = ruleTaskId(found.ruleKey);
    // Reads run the job side by side (Today's queue and its Done list): another
    // run may have made this task since the plan was drawn — make it once.
    if (tasks.snapshot((task) => task.id === id).length > 0) continue;
    await change.create(tasks, recordOfMatch(found), { id });
  }
}

// ── Rows ──

interface Lookups {
  patients: ReadonlyMap<string, Patient>;
  leads: ReadonlyMap<string, LeadRecord>;
  staff: ReadonlyMap<string, User>;
  appointments: ReadonlyMap<string, AppointmentRecord>;
  treatments: ReadonlyMap<string, Treatment>;
  invoices: ReadonlyMap<string, Invoice>;
}

const byId = <T extends { id: string }>(rows: readonly T[]) =>
  new Map(rows.map((row) => [row.id, row]));

function lookups(): Lookups {
  return {
    patients: byId(clinicFixtures.patients.snapshot()),
    leads: byId(clinicFixtures.leads.snapshot()),
    staff: byId(clinicFixtures.staff.snapshot()),
    appointments: byId(clinicFixtures.appointments.snapshot()),
    treatments: byId(clinicFixtures.treatments.snapshot()),
    invoices: byId(clinicFixtures.invoices.snapshot()),
  };
}

const fullName = (patient: Pick<Patient, 'firstName' | 'lastName'>) =>
  [patient.firstName, patient.lastName].filter(Boolean).join(' ');
const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/**
 * What the person's contact card reads (REPLACE_WITH_API: the schema's
 * `contactCard`): a lead who became a patient reads as that patient; a lead
 * as a lead; a chat-only contact thread as a contact.
 */
function contactOf(
  patient: Patient | undefined,
  lead: LeadRecord | undefined,
  view: Lookups,
): Pick<TaskPerson, 'kind' | 'seq' | 'phone'> {
  const record =
    patient ?? (lead?.patientId ? view.patients.get(lead.patientId) : undefined);
  if (record) return { kind: 'patient', seq: record.seq, phone: record.phone };
  if (lead && !lead.isContactThread) {
    return { kind: 'lead', seq: lead.seq, phone: lead.phone };
  }
  return { kind: 'contact', seq: null, phone: lead?.phone ?? null };
}

function personOf(
  task: Pick<TaskRecord, 'patientId' | 'leadId'>,
  view: Lookups,
): TaskPerson {
  const patient = task.patientId ? view.patients.get(task.patientId) : undefined;
  const lead = task.leadId ? view.leads.get(task.leadId) : undefined;
  const name = patient ? fullName(patient) : (lead?.name ?? '');
  return {
    name,
    firstName: patient?.firstName ?? firstWord(name),
    patientId: task.patientId,
    leadId: task.leadId,
    isPatient: patient !== undefined || Boolean(lead?.patientId),
    ...contactOf(patient, lead, view),
  };
}

const seqIn = (
  records: ReadonlyMap<string, { seq: number }>,
  id: string | null,
): number | null => (id === null ? null : (records.get(id)?.seq ?? null));

function sourceOf(task: TaskRecord, view: Lookups): TaskSourceRef {
  const id = task.sourceId;
  switch (task.sourceType) {
    case 'lead':
      return { kind: 'lead', id, seq: seqIn(view.leads, id) };
    case 'appointment':
      return { kind: 'appointment', id, seq: seqIn(view.appointments, id) };
    case 'treatment':
      // The contract gives a treatment no `seq` (the prototype showed its row id).
      return { kind: 'treatment', id, seq: null };
    case 'invoice':
      return { kind: 'invoice', id, seq: seqIn(view.invoices, id) };
    default: {
      const patient = task.patientId ? view.patients.get(task.patientId) : undefined;
      return patient
        ? { kind: 'patient', id: patient.id, seq: patient.seq }
        : { kind: 'contact', id: null, seq: null };
    }
  }
}

function staffOf(user: User): TaskStaff {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    initials: user.initials,
    tone: user.tone,
    active: user.active,
    roles: user.roles,
    presence: user.presence,
    phone: user.phone,
    email: user.email,
  };
}

function rowOf(task: TaskRecord, view: Lookups, exists = true): TaskRow {
  const owner = task.ownerId ? view.staff.get(task.ownerId) : undefined;
  return {
    ...task,
    person: personOf(task, view),
    source: sourceOf(task, view),
    owner: owner ? staffOf(owner) : null,
    previousOwners: task.previousOwnerIds.flatMap((id) => {
      const user = view.staff.get(id);
      return user ? [staffOf(user)] : [];
    }),
    ownedByViewer: task.ownerId === FIXTURE_VIEWER_ID,
    exists,
  };
}

// ── Reads ──

const COMMON_FIELDS = {
  organizationId: FIXTURE_ORGANIZATION_ID,
  createdById: FIXTURE_ACTOR_ID,
  deletedAt: null,
  deleteReason: null,
  deleteNote: null,
} as const;

/**
 * Visits a WhatsApp "Yes" confirmed, as Done entries with no task behind them
 * (`tasks.md:58`, H:4270; Appendix F asks the API for them): Confirmed, from
 * today on, never handled through a Confirm visits task — at most four.
 */
function confirmedByWhatsApp(now: Date, view: Lookups): TaskRow[] {
  const today = clinicToday(now);
  const handled = new Set(
    clinicFixtures.tasks
      .snapshot((task) => task.rule === 'confirm' && task.sourceType === 'appointment')
      .map((task) => task.sourceId),
  );
  const stamp = now.toISOString();
  return clinicFixtures.appointments
    .snapshot(
      (visit) =>
        visit.status === 'confirmed' && visit.date >= today && !handled.has(visit.id),
    )
    .slice(0, CONFIRMED_ENTRIES_MAX)
    .map((visit) => {
      const person = personOf(visit, view);
      const record: TaskRecord = {
        ...COMMON_FIELDS,
        createdAt: stamp,
        updatedAt: stamp,
        id: fixtureUuid('confirmed-visit', visit.id),
        kind: TASK_RULES.confirm.kind,
        title: `Confirmed ${person.firstName}’s visit`,
        why: `${dayLabel(visit.date, today)} ${clockLabel(visit.startTime)} · ${visit.serviceLabel}`,
        ownerId: null,
        ownerRole: null,
        patientId: visit.patientId,
        leadId: visit.leadId,
        sourceType: 'appointment',
        sourceId: visit.id,
        dueAt: stamp,
        status: 'done',
        snoozedUntil: null,
        outcome: 'done',
        resolvedAt: stamp,
        rule: 'confirm',
        ruleKey: null,
        ruleOutcome: taskOutcomeKey('confirm', TASK_CLINOZY_OUTCOME),
        result: CONFIRMED_BY_WHATSAPP_RESULT,
        note: null,
        resolvedBy: 'clinozy',
        resolvedById: null,
        snoozeLabel: null,
        previousOwnerIds: [],
        manualType: null,
        priority: 'normal',
        remindMinutesBefore: null,
      };
      return rowOf(record, view, false);
    });
}

function inView(task: TaskRecord, query: TaskListQuery, today: string): boolean {
  if (!ruleSettings[task.rule].on) return false;
  if (query.type.length > 0 && !query.type.includes(task.rule)) return false;
  if (
    query.scope === 'mine' &&
    task.ownerId !== null &&
    task.ownerId !== FIXTURE_VIEWER_ID
  ) {
    return false;
  }
  if (query.tab === 'queue') return task.status === 'open';
  if (query.tab === 'snoozed') return task.status === 'snoozed';
  return (
    task.status === 'done' &&
    task.resolvedAt !== null &&
    clinicToday(new Date(task.resolvedAt)) === today
  );
}

function matchesSearch(row: TaskRow, needle: string): boolean {
  if (!needle) return true;
  return `${row.title} ${row.person.name} ${row.why ?? ''}`
    .toLowerCase()
    .includes(needle);
}

const byDue = (a: TaskRecord, b: TaskRecord) =>
  a.dueAt.localeCompare(b.dueAt) ||
  a.createdAt.localeCompare(b.createdAt) ||
  a.id.localeCompare(b.id);

/**
 * One page of the list (`listTasks`, S:1722): the view, the scope ("Mine" is
 * mine and unowned), the rule filter and the search over title, person and why
 * line; rules switched off drop out of every view; by due time, 50 a page.
 * The Done view is today's, then the WhatsApp-confirmed visits.
 */
export async function listTasks(
  rawQuery: unknown,
  after?: string,
): Promise<ListPage<TaskRow>> {
  const query = validateClinicInput(taskListQuerySchema, rawQuery);
  const now = new Date();
  await syncTaskRules(now);
  const view = lookups();
  const today = clinicToday(now);
  const needle = query.q.toLowerCase();
  const page = await clinicFixtures.tasks.list({
    where: (task) =>
      inView(task, query, today) && matchesSearch(rowOf(task, view), needle),
    sort: byDue,
    cursor: after ?? null,
  });
  const rows = page.items.map((task) => rowOf(task, view));
  const last = page.nextCursor === null;
  const entries =
    query.tab === 'done' && last
      ? confirmedByWhatsApp(now, view).filter(
          (row) =>
            ruleSettings.confirm.on &&
            (query.type.length === 0 || query.type.includes('confirm')) &&
            matchesSearch(row, needle),
        )
      : [];
  return { rows: [...rows, ...entries], next: page.nextCursor, hasMore: !last };
}

function sourceRecordOf(task: TaskRecord, view: Lookups): TaskSourceRecord | null {
  const found = <T>(records: ReadonlyMap<string, T>): T | undefined =>
    task.sourceId === null ? undefined : records.get(task.sourceId);
  switch (task.sourceType) {
    case 'appointment': {
      const appointment = found(view.appointments);
      return appointment ? { kind: 'appointment', appointment } : null;
    }
    case 'lead': {
      const lead = found(view.leads);
      return lead ? { kind: 'lead', lead } : null;
    }
    case 'treatment': {
      const treatment = found(view.treatments);
      return treatment ? { kind: 'treatment', treatment } : null;
    }
    case 'invoice': {
      const invoice = found(view.invoices);
      return invoice ? { kind: 'invoice', invoice } : null;
    }
    case null: {
      const patient = task.patientId ? view.patients.get(task.patientId) : undefined;
      return patient ? { kind: 'patient', patient } : null;
    }
    default:
      return null;
  }
}

const threadOf = (task: Pick<TaskRecord, 'leadId' | 'patientId'>) =>
  findPersonThread(clinicFixtures.leads.snapshot(), {
    leadId: task.leadId,
    patientId: task.patientId,
    phone: null,
  });

const messagesOf = (leadId: string): LeadMessage[] =>
  clinicFixtures.leadMessages
    .snapshot((message) => message.leadId === leadId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));

/** The message the drawer quotes: their unreplied message, or the undelivered one. */
function quoteOf(task: TaskRecord, activity: readonly LeadMessage[]): string | null {
  const real = activity.filter((message) => !message.isSystem);
  if (task.rule === 'reply') {
    const last = real.at(-1);
    return last?.direction === 'received' ? last.body : null;
  }
  if (task.rule === 'failed') {
    return (
      [...real].reverse().find((message) => message.deliveryStatus === 'failed')?.body ??
      null
    );
  }
  return null;
}

function suggestionOf(
  task: TaskRecord,
  person: TaskPerson,
  thread: LeadRecord | null,
  view: Lookups,
  today: string,
): string | null {
  const visit =
    task.sourceType === 'appointment' && task.sourceId
      ? view.appointments.get(task.sourceId)
      : undefined;
  return suggestedMessage(task.rule, {
    first: person.firstName,
    interest: interestLabel(thread?.interests[0]),
    visit: visit
      ? {
          service: visit.serviceLabel,
          day: dayLabel(visit.date, today),
          time: clockLabel(visit.startTime),
        }
      : null,
  });
}

/** The staff the drawer names: owners, the lead's owner, the visit's or treatment's people. */
function staffNamed(
  task: TaskRecord,
  source: TaskSourceRecord | null,
  thread: LeadRecord | null,
  view: Lookups,
): TaskStaff[] {
  const ids = new Set<string | null>([
    task.ownerId,
    ...task.previousOwnerIds,
    thread?.ownerId ?? null,
  ]);
  if (source?.kind === 'appointment') {
    ids.add(source.appointment.doctorId);
    ids.add(source.appointment.therapistId);
  }
  if (source?.kind === 'treatment') {
    ids.add(source.treatment.doctorId);
    ids.add(source.treatment.therapistId);
  }
  return [...ids].flatMap((id) => {
    const user = id ? view.staff.get(id) : undefined;
    return user ? [staffOf(user)] : [];
  });
}

/** The drawer's read (`getTask`, S:1723): the task, its source record and the person's thread. */
export async function getTask(taskId: string): Promise<TaskDetail> {
  const now = new Date();
  await syncTaskRules(now);
  const task = await clinicFixtures.tasks.get(taskId);
  const view = lookups();
  const row = rowOf(task, view);
  const source = sourceRecordOf(task, view);
  const thread = threadOf(task);
  const activity = thread ? messagesOf(thread.id) : [];
  return {
    task: row,
    source,
    patient: (task.patientId && view.patients.get(task.patientId)) || null,
    thread,
    activity,
    quote: quoteOf(task, activity),
    suggestion: suggestionOf(task, row.person, thread, view, clinicToday(now)),
    staff: staffNamed(task, source, thread, view),
  };
}

// ── Writes ──

async function openTask(taskId: string, now: Date): Promise<TaskRecord> {
  await syncTaskRules(now);
  const task = await clinicFixtures.tasks.get(taskId);
  if (task.status === 'done') {
    throw clinicHttpError(409, 'already_resolved', 'This task is already closed');
  }
  return task;
}

async function answer(taskId: string, change: FixtureChange): Promise<TaskChange> {
  const undoToken = crypto.randomUUID();
  undoLog.set(undoToken, change);
  return { task: rowOf(await clinicFixtures.tasks.get(taskId), lookups()), undoToken };
}

interface EffectContext {
  task: TaskRecord;
  text: OutcomeServerText;
  thread: LeadRecord | null;
  visit: AppointmentRecord | null;
  note: string | null;
  now: Date;
  today: string;
  change: FixtureChange;
  textContext: OutcomeTextContext;
}

/** The undelivered message of a lead with nothing sent after it. */
function failedMessageOf(leadId: string): LeadMessage | undefined {
  const real = messagesOf(leadId).filter((message) => !message.isSystem);
  for (let index = real.length - 1; index >= 0; index -= 1) {
    const message = real[index];
    if (message?.deliveryStatus === 'failed') return message;
    if (
      message?.direction === 'sent' &&
      message.channel !== 'note' &&
      message.channel !== 'call'
    ) {
      return undefined;
    }
  }
  return undefined;
}

/** The lead a lead rule's task points at. */
const sourceLeadOf = (task: TaskRecord): LeadRecord | undefined =>
  task.sourceType === 'lead' && task.sourceId
    ? clinicFixtures.leads.snapshot((row) => row.id === task.sourceId)[0]
    : undefined;

type EffectOf<T extends TaskOutcomeEffect['type']> = Extract<
  TaskOutcomeEffect,
  { type: T }
>;

/** How the fixture server writes each effect (`tasks.md:185–227`, "What it writes"). */
const EFFECTS: {
  [T in TaskOutcomeEffect['type']]: (
    effect: EffectOf<T>,
    at: EffectContext,
  ) => Promise<void>;
} = {
  async leadStatus(effect, { task, change }) {
    const lead = sourceLeadOf(task);
    if (lead)
      await change.update(clinicFixtures.leads, lead.id, { status: effect.status });
  },
  async leadFollowUpTomorrow(effect, { task, change, today }) {
    const lead = sourceLeadOf(task);
    if (!lead) return;
    await change.update(clinicFixtures.leads, lead.id, {
      followUpAt: clinicInstant(addCivilDays(today, 1), effect.at),
    });
  },
  async logCall(_effect, { task, change, thread, text, now }) {
    if (!(thread && text.callNote)) return;
    await change.create(
      clinicFixtures.leadMessages,
      systemLine(thread.id, text.callNote, task.id, now, 'call'),
    );
  },
  async claimLead(_effect, { task, change }) {
    const lead = sourceLeadOf(task);
    if (!lead) return;
    const involved = new Set([...lead.involvedIds, lead.ownerId]);
    involved.delete(FIXTURE_VIEWER_ID);
    await change.update(clinicFixtures.leads, lead.id, {
      ownerId: FIXTURE_VIEWER_ID,
      involvedIds: [...involved].filter((id): id is string => id !== null),
    });
  },
  async resendMessage(_effect, { task, change }) {
    const lead = sourceLeadOf(task);
    const failed = lead ? failedMessageOf(lead.id) : undefined;
    if (failed) {
      await change.update(clinicFixtures.leadMessages, failed.id, {
        deliveryStatus: 'sent',
      });
    }
  },
  async appointmentStatus(effect, { change, visit, now }) {
    if (!visit) return;
    // The same status write as Appointments: stamps, the cancel reason, open leads → Clinic visited.
    await writeAppointmentStatus(change, visit, effect.status, {
      now,
      cancelReason: 'patient_asked',
    });
  },
  async sendWhatsApp(_effect, { task, change, thread, text, textContext, now }) {
    if (!(thread && text.whatsApp)) return;
    await change.create(
      clinicFixtures.leadMessages,
      systemLine(thread.id, text.whatsApp(textContext), task.id, now, 'whatsapp'),
    );
  },
  async unhappyTask(_effect, { task, change, visit, today }) {
    if (!visit) return;
    const person = personOf(task, lookups());
    await change.create(clinicFixtures.tasks, {
      ...unhappyTaskText({
        first: person.firstName,
        service: visit.serviceLabel,
        visitDate: visit.date,
        today,
      }),
      ...OPEN_TASK,
      kind: TASK_RULES.unhappy.kind,
      rule: 'unhappy',
      ownerId: visit.doctorId,
      ownerRole: null,
      patientId: task.patientId,
      leadId: task.leadId,
      sourceType: 'appointment',
      sourceId: visit.id,
      dueAt: clinicInstant(today, '18:00'),
    });
  },
  async betterCheckIn(_effect, { task, change, note, today }) {
    if (!task.patientId) return;
    const treatment =
      task.sourceType === 'treatment' && task.sourceId
        ? clinicFixtures.treatments.snapshot((row) => row.id === task.sourceId)[0]
        : undefined;
    await change.create(clinicFixtures.checkIns, {
      patientId: task.patientId,
      appointmentId: null,
      treatmentId: treatment?.id ?? null,
      context: treatment?.name ?? 'Treatment',
      feel: 'better',
      // The contract's score is required; the plan asks for a nullable one (Appendix F).
      score: 0,
      followed: null,
      followedNote: null,
      now: note ?? 'Doing well on the call',
      nextPlan: null,
      nextOfferingIds: [],
      byId: FIXTURE_VIEWER_ID,
      date: today,
    });
  },
  async patientFollowUp(effect, { task, change, today }) {
    if (!task.patientId) return;
    await change.update(clinicFixtures.patients, task.patientId, {
      followUpAt: clinicInstant(addCivilDays(today, effect.days), '11:00'),
    });
  },
};

async function applyEffect(effect: TaskOutcomeEffect, at: EffectContext): Promise<void> {
  // TypeScript can't correlate the union with the handler map; each handler takes its own type.
  const write = EFFECTS[effect.type] as (
    effect: TaskOutcomeEffect,
    at: EffectContext,
  ) => Promise<void>;
  await write(effect, at);
}

/** What an outcome's writes and text read: the visit, its doctor, the thread, the dates. */
function effectContextOf(
  task: TaskRecord,
  outcome: TaskRuleOutcome,
  input: { note: string | null; now: Date; change: FixtureChange },
): EffectContext {
  const today = clinicToday(input.now);
  const view = lookups();
  const visit =
    task.sourceType === 'appointment' && task.sourceId
      ? (view.appointments.get(task.sourceId) ?? null)
      : null;
  const doctor = visit ? view.staff.get(visit.doctorId) : undefined;
  const followUp = outcome.effects.find((effect) => effect.type === 'patientFollowUp');
  return {
    ...input,
    task,
    text: TASK_OUTCOME_TEXT[taskOutcomeKey(task.rule, outcome.id)] ?? {},
    thread: threadOf(task),
    visit,
    today,
    textContext: {
      doctor: doctor ? staffShortName(doctor) : '',
      followUpDate: addCivilDays(today, followUp?.days ?? 0),
      visitSeq: visit?.seq ?? null,
    },
  };
}

/** Close the task with the outcome's result — the note appended — and say so on the thread. */
async function closeWithOutcome(
  outcome: TaskRuleOutcome,
  at: EffectContext,
): Promise<void> {
  const { task, change, note, now, thread } = at;
  const result = at.text.result?.(at.textContext) ?? '';
  await change.update(clinicFixtures.tasks, task.id, {
    status: 'done',
    outcome: outcome.contractOutcome,
    ruleOutcome: taskOutcomeKey(task.rule, outcome.id),
    result: note ? `${result} · ${note}` : result,
    note,
    resolvedAt: now.toISOString(),
    resolvedBy: 'member',
    resolvedById: FIXTURE_VIEWER_ID,
    snoozedUntil: null,
    snoozeLabel: null,
  });
  if (thread) {
    await change.create(
      clinicFixtures.leadMessages,
      systemLine(thread.id, taskClosedLine(result), task.id, now),
    );
  }
}

/**
 * Close, snooze or act on a task with one of its rule's outcomes (`resolveTask`,
 * S:1728; the ~40 outcomes are Appendix F): write the outcome's effects, then
 * close it with its result (the note appended " · <note>") and a "Task closed"
 * line on the person's thread, or snooze it — or leave it to the rules ("Claim
 * it") or as it is ("Fix the number"). A closed task answers 409.
 */
export async function recordTaskOutcome(
  raw: RecordTaskOutcomeInput,
): Promise<TaskChange> {
  const input = validateClinicInput(recordTaskOutcomeInputSchema, raw);
  const now = new Date();
  const task = await openTask(input.taskId, now);
  const outcome = findTaskOutcome(task.rule, input.outcome);
  if (!outcome) {
    throw clinicHttpError(422, 'validation', 'Pick one of this task’s outcomes', {
      outcome: ['Pick one of this task’s outcomes'],
    });
  }
  const change = recordFixtureChange();
  const at = effectContextOf(task, outcome, {
    note: input.note?.trim() || null,
    now,
    change,
  });
  for (const effect of outcome.effects) await applyEffect(effect, at);

  const { disposition } = outcome;
  if (disposition.type === 'close') await closeWithOutcome(outcome, at);
  if (disposition.type === 'snooze') {
    await change.update(clinicFixtures.tasks, task.id, {
      status: 'snoozed',
      snoozedUntil: taskTimeAfter(disposition.span, now),
      snoozeLabel: at.text.snoozeLabel ?? null,
      outcome: outcome.contractOutcome,
      ruleOutcome: taskOutcomeKey(task.rule, outcome.id),
    });
  }
  // The record writes may end this task's rule (a claim) or start another (a no-show).
  await syncTaskRules(now, change);
  return answer(task.id, change);
}

/** Snooze a task with one of the drawer's options ("Tomorrow 10:00" is clinic-local). */
export async function snoozeTask(raw: SnoozeTaskInput): Promise<TaskChange> {
  const input = validateClinicInput(snoozeTaskInputSchema, raw);
  const now = new Date();
  const task = await openTask(input.taskId, now);
  const change = recordFixtureChange();
  await change.update(clinicFixtures.tasks, task.id, {
    status: 'snoozed',
    snoozedUntil: taskTimeAfter(TASK_SNOOZE_SPANS[input.option], now),
    snoozeLabel: TASK_SNOOZE_LABELS[input.option],
    outcome: null,
    ruleOutcome: null,
  });
  return answer(task.id, change);
}

function activeStaff(ownerId: string): User {
  const user = clinicFixtures.staff.snapshot((row) => row.id === ownerId)[0];
  if (!user?.active) {
    throw clinicHttpError(422, 'validation', 'Pick someone on the team', {
      ownerId: ['Pick someone on the team'],
    });
  }
  return user;
}

/**
 * Move a task to someone else — and a lead task's lead — keeping the previous
 * owner involved; the lead's chat gets "Moved from A to B · A stays involved".
 */
export async function reassignTask(raw: ReassignTaskInput): Promise<TaskChange> {
  const input = validateClinicInput(reassignTaskInputSchema, raw);
  const now = new Date();
  const task = await openTask(input.taskId, now);
  const next = activeStaff(input.ownerId);
  const change = recordFixtureChange();
  if (task.ownerId === next.id) return answer(task.id, change);
  const previousId = task.ownerId;
  await change.update(clinicFixtures.tasks, task.id, {
    ownerId: next.id,
    previousOwnerIds: previousId
      ? [...task.previousOwnerIds.filter((id) => id !== previousId), previousId]
      : task.previousOwnerIds,
  });
  const lead =
    task.sourceType === 'lead' && task.sourceId
      ? clinicFixtures.leads.snapshot((row) => row.id === task.sourceId)[0]
      : undefined;
  if (lead) {
    const involved = new Set([...lead.involvedIds, previousId]);
    involved.delete(next.id);
    await change.update(clinicFixtures.leads, lead.id, {
      ownerId: next.id,
      involvedIds: [...involved].filter((id): id is string => id !== null),
    });
    const previous = previousId
      ? clinicFixtures.staff.snapshot((row) => row.id === previousId)[0]
      : undefined;
    if (previous) {
      await change.create(
        clinicFixtures.leadMessages,
        systemLine(
          lead.id,
          taskMovedLine(staffShortName(previous), staffShortName(next)),
          task.id,
          now,
        ),
      );
    }
  }
  return answer(task.id, change);
}

/**
 * Create a task (`createTask`, S:1727): a "Follow-ups you set" task from
 * "What’s next" — its source copied from the task it follows — or a New task.
 */
export async function createTask(raw: CreateTaskInput): Promise<TaskChange> {
  const change = recordFixtureChange();
  const created = await createTaskIn(change, raw);
  return answer(created.id, change);
}

/**
 * Where a created task points: the task it follows' source; else, for a New
 * task about a pipeline lead (not a patient), that lead — its chip reads
 * "Lead #…"; else nothing (a patient's chip names the patient).
 */
function createdSourceOf(
  followed: TaskRecord | null,
  patientId: string | null,
  leadId: string | null,
): Pick<TaskRecord, 'sourceType' | 'sourceId'> {
  if (followed) return { sourceType: followed.sourceType, sourceId: followed.sourceId };
  const lead =
    leadId && !patientId
      ? clinicFixtures.leads.snapshot((row) => row.id === leadId)[0]
      : undefined;
  return lead && !lead.isContactThread
    ? { sourceType: 'lead', sourceId: lead.id }
    : { sourceType: null, sourceId: null };
}

/**
 * {@link createTask}'s write inside another operation's `change` — a lead's
 * status side effects open their task this way, so one Undo takes the status
 * and its task back together. `standsFor` names the rule match a task opened
 * ahead of the job stands for (a Follow-up status's task is the "follow"
 * rule's for its day): the job counts its key and never opens a second.
 */
export async function createTaskIn(
  change: FixtureChange,
  raw: CreateTaskInput,
  standsFor?: { ruleKey: string },
): Promise<TaskRecord> {
  const input = validateClinicInput(createTaskInputSchema, raw);
  if (input.ownerId) activeStaff(input.ownerId);
  const followed = input.followsTaskId
    ? await clinicFixtures.tasks.get(input.followsTaskId)
    : null;
  const patientId = input.patientId ?? followed?.patientId ?? null;
  const leadId = input.leadId ?? followed?.leadId ?? null;
  const typeKind = input.manualType ? MANUAL_TASK_TYPE_KINDS[input.manualType] : null;
  return change.create(clinicFixtures.tasks, {
    kind: input.kind ?? typeKind ?? TASK_RULES[input.rule].kind,
    title: input.title,
    why: input.why || null,
    ownerId: input.ownerId,
    ownerRole: input.ownerRole,
    patientId,
    leadId,
    ...createdSourceOf(followed, patientId, leadId),
    dueAt: input.dueAt,
    ...OPEN_TASK,
    ruleKey: standsFor?.ruleKey ?? null,
    rule: input.rule,
    manualType: input.manualType,
    priority: input.priority,
    remindMinutesBefore: input.remindMinutesBefore,
  });
}

/**
 * "Let Clinozy do it" (`tasks.md:123`): resolved "Done by Clinozy" with the
 * rule's automation, the suggested WhatsApp sent on the person's thread.
 */
export async function handTaskToClinozy(taskId: string): Promise<TaskChange> {
  const now = new Date();
  const task = await openTask(taskId, now);
  const automation = TASK_RULES[task.rule].automation
    ? TASK_AUTOMATION_TEXT[task.rule]
    : undefined;
  if (!automation) {
    const refusal = `${PRODUCT_NAME} can’t do this task`;
    throw clinicHttpError(422, 'validation', refusal, { taskId: [refusal] });
  }
  const view = lookups();
  const thread = threadOf(task);
  const message = suggestionOf(
    task,
    personOf(task, view),
    thread,
    view,
    clinicToday(now),
  );
  const change = recordFixtureChange();
  await change.update(clinicFixtures.tasks, task.id, {
    status: 'done',
    outcome: 'done',
    ruleOutcome: taskOutcomeKey(task.rule, TASK_CLINOZY_OUTCOME),
    result: automation,
    note: null,
    resolvedAt: now.toISOString(),
    resolvedBy: 'clinozy',
    resolvedById: null,
    snoozedUntil: null,
    snoozeLabel: null,
  });
  if (thread && message) {
    await change.create(clinicFixtures.leadMessages, {
      ...systemLine(thread.id, message, task.id, now, 'whatsapp'),
      authorId: null,
    });
  }
  await syncTaskRules(now, change);
  return answer(task.id, change);
}

/** Undo a write — its every record change, side effects included (each token works once). */
export async function undoTaskChange(undoToken: string): Promise<void> {
  const change = undoLog.get(undoToken);
  if (!change) {
    throw clinicHttpError(409, 'undo_unavailable', 'This change can no longer be undone');
  }
  undoLog.delete(undoToken);
  await change.reverse();
}

/** The rules' org settings (the Rules popover). */
export async function getTaskRuleSettings(): Promise<TaskRuleSettings> {
  return structuredClone(ruleSettings);
}

/** Switch a rule off or on, or hand it to Clinozy (only rules with an automation). */
export async function saveTaskRuleSetting(
  raw: SaveTaskRuleSettingInput,
): Promise<TaskRuleSettings> {
  const { rule, ...patch } = validateClinicInput(saveTaskRuleSettingInputSchema, raw);
  if (patch.handled && !TASK_RULES[rule].automation) {
    const refusal = `${PRODUCT_NAME} can’t handle this rule`;
    throw clinicHttpError(422, 'validation', refusal, { handled: [refusal] });
  }
  ruleSettings = { ...ruleSettings, [rule]: { ...ruleSettings[rule], ...patch } };
  return structuredClone(ruleSettings);
}
