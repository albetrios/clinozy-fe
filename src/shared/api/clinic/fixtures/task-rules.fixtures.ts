import { civilDaysBetween } from '@/shared/api/clinic/clinic-fixture-seed.ts';
import type {
  AftercareCall,
  Appointment,
  Channel,
  CheckIn,
  LeadInterest,
  LeadMessage,
  LeadStatus,
  Patient,
  PatientPackage,
  TaskKind,
  TaskSource,
  Treatment,
  User,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  addCivilDays,
  clinicClockTime,
  clinicInstant,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';
import {
  LEAD_CLOSED_STATUSES,
  type LeadRecord,
} from '@/shared/api/clinic/leads-fixture-contracts.ts';
import { leadHold } from '@/shared/api/clinic/leads-fixture-hold.ts';
import {
  TASK_RULES,
  type TaskDueAnchors,
  taskDueAt,
  type TaskRecord,
  type TaskRuleGroup,
  type TaskRuleId,
} from '@/shared/api/clinic/tasks-contracts.ts';

/**
 * The fixture server's task rule job (Q-T3, REPLACE_WITH_API): which tasks the
 * rules want right now, and how the stored tasks catch up — create the new
 * ones, close the ones whose record changed ("Done by Clinozy"), wake the ones
 * whose snooze ran out. Pure: it reads a snapshot of the world and returns a
 * plan; `tasks-server.fixtures.ts` applies it before every read and write.
 *
 * The text it writes — titles, why lines, results — is server data in English
 * (`tasks.md:42–58`, `tasks.md:185–227`, H:4239–4285), the way clinozy-be will
 * store it; the UI copy of the rules lives in the `tasks` namespace.
 */

// ── Server text ──

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const civilParts = (date: string) => {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return { year, month, day };
};

/** "Today" · "Tomorrow" · "Yesterday" · "Mon 28 Sep" — a clinic-local date against today (H:4219). */
export function dayLabel(date: string, today: string): string {
  const diff = civilDaysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const { year, month, day } = civilParts(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

/** "17 Oct 2026" — the follow-up date a result names (H:4316). */
export function fullDateLabel(date: string): string {
  const { year, month, day } = civilParts(date);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "11:30 am" from a clinic-local `HH:mm` (H:4218). */
export function clockLabel(time: string): string {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

/** A staff member as the prototype names them: "Riya S.", "Asha M.", "Dr. Reenal" (`LOWN`, H:3372). */
export function staffShortName(user: Pick<User, 'firstName' | 'lastName'>): string {
  if (/^Dr\.?\s/.test(user.firstName) || !user.lastName) return user.firstName;
  return `${user.firstName} ${user.lastName.charAt(0)}.`;
}

const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  whatsapp: 'WhatsApp',
  call: 'Call',
  sms: 'SMS',
  instagram: 'Instagram',
  email: 'Email',
  note: 'Note',
};

const LEAD_STATUS_LABELS: Readonly<Record<LeadStatus, string>> = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow-up',
  clinic_visited: 'Clinic visited',
  no_response: 'No response',
  not_interested: 'Not interested',
  invalid: 'Invalid',
  lost: 'Lost',
};

const INTEREST_LABELS: Readonly<Record<LeadInterest, string>> = {
  others: 'Others',
  clinical: 'Clinical',
  peel: 'Peel',
  lhr: 'LHR',
  hydrafacial: 'Hydrafacial',
  prp: 'PRP',
};

/** The rule groups as the server writes them ("Resolved in Leads"). */
const TASK_GROUP_LABELS: Readonly<Record<TaskRuleGroup, string>> = {
  leads: 'Leads',
  appointments: 'Appointments',
  feedback: 'Feedback',
  treatments: 'Treatments',
  patients: 'Patients',
  team: 'Team',
  payments: 'Payments',
};

/** How a derived task closes itself when its record changes (`tasks.md:58`, H:4253). */
export function selfCloseResult(rule: TaskRuleId): string {
  if (rule === 'confirm') return 'Visit status changed in Appointments';
  if (rule === 'reply') return 'Reply sent from the lead chat';
  return `Resolved in ${TASK_GROUP_LABELS[TASK_RULES[rule].group]}`;
}

/** The Done entry of a visit confirmed by a WhatsApp "Yes" (`tasks.md:58`, H:4270). */
export const CONFIRMED_BY_WHATSAPP_RESULT =
  'Patient replied Yes to the WhatsApp reminder';

/** Days after the treatment its aftercare call is due. */
const AFTERCARE_CALL_DAYS: Readonly<Record<AftercareCall, number | null>> = {
  none: null,
  next_day: 1,
  in_2_days: 2,
  in_week: 7,
};

// ── Rule keys ──

/**
 * The identity of a rule match — the same condition on the same record gives
 * the same key, so the job never makes a task twice; a new message, follow-up
 * date, owner, visit slot or last visit gives a new one (server-internal).
 */
export const taskRuleKeys = {
  reply: (leadId: string, messageId: string) => `reply:${leadId}:${messageId}`,
  follow: (leadId: string, followUpDate: string) => `follow:${leadId}:${followUpDate}`,
  claim: (leadId: string, ownerId: string) => `claim:${leadId}:${ownerId}`,
  failed: (leadId: string, messageId: string) => `failed:${leadId}:${messageId}`,
  confirm: (visit: Pick<Appointment, 'id' | 'date' | 'startTime'>) =>
    `confirm:${visit.id}:${visit.date}T${visit.startTime}`,
  arrive: (visit: Pick<Appointment, 'id' | 'date' | 'startTime'>) =>
    `arrive:${visit.id}:${visit.date}T${visit.startTime}`,
  rebook: (visit: Pick<Appointment, 'id'>) => `rebook:${visit.id}`,
  feedback: (visit: Pick<Appointment, 'id'>) => `feedback:${visit.id}`,
  aftercare: (treatmentId: string) => `aftercare:${treatmentId}`,
  nextvisit: (patientId: string, lastVisitDate: string) =>
    `nextvisit:${patientId}:${lastVisitDate}`,
  noreply: (patientId: string, lastVisitDate: string) =>
    `noreply:${patientId}:${lastVisitDate}`,
} as const;

// ── The world the job reads ──

/** One snapshot of the world, the signed-in member and the org's lead hold. */
export interface TaskRuleWorld {
  now: Date;
  viewerId: string;
  /** Days a lead's owner holds it before it opens to the team (H:4013: 3). */
  holdDays: number;
  staff: readonly User[];
  patients: readonly Patient[];
  leads: readonly LeadRecord[];
  messages: readonly LeadMessage[];
  appointments: readonly Appointment[];
  treatments: readonly Treatment[];
  checkIns: readonly CheckIn[];
  packages: readonly Pick<
    PatientPackage,
    'patientId' | 'sessionsUsed' | 'sessionsTotal'
  >[];
}

/** A task one of the rules wants to exist now. */
export interface TaskRuleMatch {
  ruleKey: string;
  rule: TaskRuleId;
  kind: TaskKind;
  title: string;
  why: string;
  dueAt: string;
  ownerId: string | null;
  patientId: string | null;
  leadId: string | null;
  sourceType: TaskSource | null;
  sourceId: string | null;
}

/** A person as the job names them. */
interface Person {
  name: string;
  first: string;
  patientId: string | null;
  leadId: string | null;
}

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function lastIndexWhere<T>(items: readonly T[], test: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && test(item)) return index;
  }
  return -1;
}
const patientName = (patient: Pick<Patient, 'firstName' | 'lastName'>) =>
  [patient.firstName, patient.lastName].filter(Boolean).join(' ');

/** Statuses after which a lead needs nothing more (H:4243). */
const CLOSED_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set(LEAD_CLOSED_STATUSES);
const FOLLOW_UP_STATUSES: ReadonlySet<LeadStatus> = new Set([
  'follow_up',
  'contacted',
  'no_response',
]);

interface Context {
  world: TaskRuleWorld;
  today: string;
  staffById: ReadonlyMap<string, User>;
  patientById: ReadonlyMap<string, Patient>;
  leadById: ReadonlyMap<string, LeadRecord>;
  messagesByLead: ReadonlyMap<string, LeadMessage[]>;
}

function contextOf(world: TaskRuleWorld): Context {
  const messagesByLead = new Map<string, LeadMessage[]>();
  for (const message of [...world.messages].sort((a, b) =>
    a.sentAt.localeCompare(b.sentAt),
  )) {
    const thread = messagesByLead.get(message.leadId) ?? [];
    thread.push(message);
    messagesByLead.set(message.leadId, thread);
  }
  return {
    world,
    today: clinicToday(world.now),
    staffById: new Map(world.staff.map((user) => [user.id, user])),
    patientById: new Map(world.patients.map((patient) => [patient.id, patient])),
    leadById: new Map(world.leads.map((lead) => [lead.id, lead])),
    messagesByLead,
  };
}

const staffName = (context: Context, id: string | null) => {
  const user = id ? context.staffById.get(id) : undefined;
  return user ? staffShortName(user) : 'Anyone';
};

function visitPerson(context: Context, visit: Appointment): Person | null {
  const patient = visit.patientId ? context.patientById.get(visit.patientId) : undefined;
  if (patient) {
    const name = patientName(patient);
    return {
      name,
      first: patient.firstName,
      patientId: patient.id,
      leadId: visit.leadId,
    };
  }
  const lead = visit.leadId ? context.leadById.get(visit.leadId) : undefined;
  if (!lead) return null;
  return {
    name: lead.name,
    first: firstWord(lead.name),
    patientId: lead.patientId,
    leadId: lead.id,
  };
}

function due(rule: TaskRuleId, anchors: Omit<TaskDueAnchors, 'now'>, context: Context) {
  const at = taskDueAt(TASK_RULES[rule].due, { now: context.world.now, ...anchors });
  if (at === null) throw new Error(`Task rule job: no due anchor for ${rule}`);
  return at;
}

function match(
  rule: TaskRuleId,
  fields: Omit<TaskRuleMatch, 'rule' | 'kind' | 'sourceType'> & {
    sourceType?: TaskSource | null;
  },
): TaskRuleMatch {
  return {
    rule,
    kind: TASK_RULES[rule].kind,
    sourceType: TASK_RULES[rule].sourceType,
    ...fields,
  };
}

// ── Leads: Unreplied messages, Messages not delivered, LeadRecord follow-ups, Leads open to claim ──

/** What every lead rule reads about one lead. */
interface LeadScope {
  context: Context;
  lead: LeadRecord;
  /** Its messages without the system lines, oldest first. */
  real: readonly LeadMessage[];
  first: string;
  closed: boolean;
}

const leadFields = (lead: LeadRecord) => ({
  patientId: lead.patientId,
  leadId: lead.id,
  sourceId: lead.id,
});

/** Unreplied messages: their last real message is inbound, the lead still open. */
function replyMatch({
  context,
  lead,
  real,
  first,
  closed,
}: LeadScope): TaskRuleMatch | null {
  const last = real.at(-1);
  if (last?.direction !== 'received' || closed) return null;
  const waited = Math.max(
    0,
    Math.round((context.world.now.getTime() - Date.parse(last.sentAt)) / 60_000),
  );
  return match('reply', {
    ...leadFields(lead),
    ruleKey: taskRuleKeys.reply(lead.id, last.id),
    title: `Reply to ${first}`,
    why: `Wrote on ${CHANNEL_LABELS[last.channel]} · waiting ${waited} min`,
    dueAt: due('reply', { messageAt: last.sentAt }, context),
    ownerId: lead.ownerId,
  });
}

/** A message that reached them: sent on a channel, not a note or a call log, not failed. */
const resends = (message: LeadMessage) =>
  message.direction === 'sent' &&
  message.channel !== 'note' &&
  message.channel !== 'call' &&
  message.deliveryStatus !== 'failed';

/** Messages not delivered: the last failed message, nothing sent after it. */
function failedMatch({ context, lead, real, first }: LeadScope): TaskRuleMatch | null {
  const failedAt = lastIndexWhere(real, (message) => message.deliveryStatus === 'failed');
  const failed = failedAt < 0 ? undefined : real[failedAt];
  if (!failed || real.slice(failedAt + 1).some(resends)) return null;
  const sentAt = clockLabel(clinicClockTime(new Date(failed.sentAt)));
  return match('failed', {
    ...leadFields(lead),
    ruleKey: taskRuleKeys.failed(lead.id, failed.id),
    title: `Message to ${first} not delivered`,
    why: `${CHANNEL_LABELS[failed.channel]} could not deliver at ${sentAt}`,
    dueAt: due('failed', {}, context),
    ownerId: lead.ownerId,
  });
}

/** LeadRecord follow-ups: an open follow-up whose date has come. */
function followMatch({ context, lead, first }: LeadScope): TaskRuleMatch | null {
  const followUpDate = lead.followUpAt ? clinicToday(new Date(lead.followUpAt)) : null;
  if (lead.status === null || !FOLLOW_UP_STATUSES.has(lead.status)) return null;
  if (followUpDate === null || followUpDate > context.today) return null;
  const interests = lead.interests
    .map((interest) => INTEREST_LABELS[interest])
    .join(', ');
  const wasDue = dayLabel(followUpDate, context.today).toLowerCase();
  return match('follow', {
    ...leadFields(lead),
    ruleKey: taskRuleKeys.follow(lead.id, followUpDate),
    title: `Follow up with ${first}`,
    why: `${LEAD_STATUS_LABELS[lead.status]} · follow-up was due ${wasDue} · interested in ${interests || '—'}`,
    dueAt: due('follow', { followUpDate }, context),
    ownerId: lead.ownerId,
  });
}

/**
 * Leads open to claim: someone else's lead the hold has opened — its owner left,
 * released it, or sat past the hold (the same `leadHold` the Leads room reads).
 */
function claimMatch({ context, lead, first }: LeadScope): TaskRuleMatch | null {
  const { world } = context;
  const owner = lead.ownerId ? context.staffById.get(lead.ownerId) : undefined;
  if (!owner || owner.id === world.viewerId) return null;
  const hold = leadHold({ ...lead, ownerGone: !owner.active }, world.holdDays, world.now);
  if (!hold.open) return null;
  const idle = hold.idleDays;
  const ownerName = staffShortName(owner);
  return match('claim', {
    ...leadFields(lead),
    ruleKey: taskRuleKeys.claim(lead.id, owner.id),
    title: `Claim or leave ${first}`,
    why: owner.active
      ? `${ownerName} has been idle ${idle} days · anyone can take it`
      : `${ownerName} has left the clinic · open to the team`,
    dueAt: due('claim', {}, context),
    ownerId: null,
  });
}

function leadMatches(context: Context, lead: LeadRecord): TaskRuleMatch[] {
  const scope: LeadScope = {
    context,
    lead,
    real: (context.messagesByLead.get(lead.id) ?? []).filter(
      (message) => !message.isSystem,
    ),
    first: firstWord(lead.name),
    closed: lead.status !== null && CLOSED_LEAD_STATUSES.has(lead.status),
  };
  return [
    replyMatch(scope),
    failedMatch(scope),
    followMatch(scope),
    claimMatch(scope),
  ].filter((found): found is TaskRuleMatch => found !== null);
}

// ── Appointments: Confirm visits, Arrived or no-show, Rebook no-shows, Collect feedback ──

function visitMatches(context: Context, visit: Appointment): TaskRuleMatch[] {
  const { world, today } = context;
  const person = visitPerson(context, visit);
  if (!person) return [];
  const start = Date.parse(clinicInstant(visit.date, visit.startTime));
  const hoursAway = (start - world.now.getTime()) / 3_600_000;
  const doctor = staffName(context, visit.doctorId);
  const when = `${dayLabel(visit.date, today)} ${clockLabel(visit.startTime)}`;
  const anchors = { visit: { date: visit.date, startTime: visit.startTime } };
  const base = {
    patientId: person.patientId,
    leadId: person.leadId,
    sourceId: visit.id,
    ownerId: world.viewerId,
  };
  const matches: TaskRuleMatch[] = [];

  if (visit.status === 'scheduled' && hoursAway > 0 && hoursAway <= 48) {
    matches.push(
      match('confirm', {
        ...base,
        ruleKey: taskRuleKeys.confirm(visit),
        title: `Confirm ${person.first}’s visit`,
        why: `${when} · ${visit.serviceLabel} with ${doctor} · no reply to the reminder`,
        dueAt: due('confirm', anchors, context),
      }),
    );
  }
  if (
    (visit.status === 'scheduled' || visit.status === 'confirmed') &&
    visit.date === today &&
    hoursAway < -0.25
  ) {
    matches.push(
      match('arrive', {
        ...base,
        ruleKey: taskRuleKeys.arrive(visit),
        title: `Has ${person.first} arrived?`,
        why: `${when} · ${visit.serviceLabel} with ${doctor} · not checked in yet`,
        dueAt: due('arrive', anchors, context),
      }),
    );
  }
  if (visit.status === 'no_show') {
    matches.push(
      match('rebook', {
        ...base,
        ruleKey: taskRuleKeys.rebook(visit),
        title: `Rebook ${person.first}`,
        why: `Missed ${visit.serviceLabel} on ${when}`,
        dueAt: due('rebook', anchors, context),
      }),
    );
  }
  if (
    visit.status === 'completed' &&
    visit.date < today &&
    visit.date >= addCivilDays(today, -3)
  ) {
    matches.push(
      match('feedback', {
        ...base,
        ruleKey: taskRuleKeys.feedback(visit),
        title: `Ask ${person.first} how it went`,
        why: `${visit.serviceLabel} with ${doctor} on ${dayLabel(
          visit.date,
          today,
        )} · ask for a rating and book the next session`,
        dueAt: due('feedback', anchors, context),
      }),
    );
  }
  return matches;
}

// ── Treatments: Aftercare calls ──

function aftercareMatch(context: Context, treatment: Treatment): TaskRuleMatch[] {
  const { world, today } = context;
  const days = AFTERCARE_CALL_DAYS[treatment.aftercareCall];
  if (days === null) return [];
  if (world.checkIns.some((checkIn) => checkIn.treatmentId === treatment.id)) return [];
  const patient = context.patientById.get(treatment.patientId);
  if (!patient) return [];
  const day = clinicToday(new Date(treatment.performedAt));
  const callName = days === 1 ? 'Next-day' : `Day-${days}`;
  const dueAt = due(
    'aftercare',
    { treatment: { date: day, callAfterDays: days } },
    context,
  );
  const now = world.now.getTime();
  // Shown from two days before the call day until 30 days after the treatment.
  if (Date.parse(dueAt) - now > 2 * 86_400_000) return [];
  if (now - Date.parse(clinicInstant(day, '11:00')) > 30 * 86_400_000) return [];
  return [
    match('aftercare', {
      ruleKey: taskRuleKeys.aftercare(treatment.id),
      title: `${callName} call · ${patient.firstName}`,
      why: `${treatment.name} on ${dayLabel(day, today).toLowerCase()} · ask how the skin feels and what they followed`,
      dueAt,
      ownerId: world.viewerId,
      patientId: patient.id,
      leadId: patient.leadId,
      sourceId: treatment.id,
    }),
  ];
}

// ── Patients: Next visit not set, Regulars gone quiet ──

const BOOKED: ReadonlySet<Appointment['status']> = new Set(['scheduled', 'confirmed']);

function patientMatches(context: Context, patient: Patient): TaskRuleMatch[] {
  const { world, today } = context;
  const visits = world.appointments.filter((visit) => visit.patientId === patient.id);
  const done = visits
    .filter((visit) => visit.status === 'completed' && visit.date < today)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    );
  const booked = visits.some((visit) => visit.date >= today && BOOKED.has(visit.status));
  const last = done[0];
  if (!last || booked) return [];
  const days = Math.round(
    (world.now.getTime() - Date.parse(clinicInstant(last.date, last.startTime))) /
      86_400_000,
  );
  const base = {
    ownerId: world.viewerId,
    patientId: patient.id,
    leadId: patient.leadId,
    sourceId: null,
  };
  const matches: TaskRuleMatch[] = [];
  if (patient.followUpAt === null && days >= 1 && days <= 45) {
    matches.push(
      match('nextvisit', {
        ...base,
        ruleKey: taskRuleKeys.nextvisit(patient.id, last.date),
        title: `Set ${patient.firstName}’s next visit`,
        why: `${last.serviceLabel} on ${dayLabel(last.date, today).toLowerCase()} · no follow-up date and nothing booked`,
        dueAt: due('nextvisit', {}, context),
      }),
    );
  }
  const sessionsLeft = world.packages.some(
    (pack) => pack.patientId === patient.id && pack.sessionsUsed < pack.sessionsTotal,
  );
  if ((sessionsLeft || done.length >= 2) && days >= 30) {
    const reminders = Math.min(3, Math.floor((days - 30) / 10) + 1);
    matches.push(
      match('noreply', {
        ...base,
        ruleKey: taskRuleKeys.noreply(patient.id, last.date),
        title: `${patient.firstName} has gone quiet`,
        why: `${sessionsLeft ? 'Package has sessions left' : 'Regular patient'} · last visit ${days} days ago · ${reminders} reminder${reminders === 1 ? '' : 's'} sent, no reply`,
        dueAt: due('noreply', {}, context),
      }),
    );
  }
  return matches;
}

/**
 * Every task the rules want now (H:4239–4269). Contact threads are not leads —
 * no lead rule reads them (S:261); deleted records are already out of the
 * snapshot.
 */
export function deriveRuleTasks(world: TaskRuleWorld): TaskRuleMatch[] {
  const context = contextOf(world);
  const matches = [
    ...world.leads
      .filter((lead) => !lead.isContactThread)
      .flatMap((lead) => leadMatches(context, lead)),
    ...world.appointments.flatMap((visit) => visitMatches(context, visit)),
    ...world.treatments.flatMap((treatment) => aftercareMatch(context, treatment)),
    ...world.patients.flatMap((patient) => patientMatches(context, patient)),
  ];
  const seen = new Set<string>();
  return matches.filter((candidate) => {
    if (seen.has(candidate.ruleKey)) return false;
    seen.add(candidate.ruleKey);
    return true;
  });
}

/** How the stored tasks catch up with the rules. */
export interface TaskRuleSync {
  /** Matches no task carries yet. */
  create: TaskRuleMatch[];
  /** Snoozed tasks whose time has come — back to To do. */
  wake: string[];
  /** Open or snoozed derived tasks whose condition is gone — closed by Clinozy. */
  close: { id: string; result: string }[];
}

/**
 * Compare the stored tasks with the rule matches. A closed task stays closed
 * (its key is spent); tasks an outcome or a member made carry no key and are
 * never closed by the job.
 */
export function planTaskRuleSync(
  tasks: readonly TaskRecord[],
  matches: readonly TaskRuleMatch[],
  now: Date,
): TaskRuleSync {
  const wanted = new Set(matches.map((candidate) => candidate.ruleKey));
  const known = new Set(tasks.flatMap((task) => (task.ruleKey ? [task.ruleKey] : [])));
  return {
    create: matches.filter((candidate) => !known.has(candidate.ruleKey)),
    wake: tasks
      .filter(
        (task) =>
          task.status === 'snoozed' &&
          task.snoozedUntil !== null &&
          Date.parse(task.snoozedUntil) <= now.getTime(),
      )
      .map((task) => task.id),
    close: tasks
      .filter(
        (task) =>
          task.status !== 'done' &&
          task.ruleKey !== null &&
          TASK_RULES[task.rule].derived &&
          !wanted.has(task.ruleKey),
      )
      .map((task) => ({ id: task.id, result: selfCloseResult(task.rule) })),
  };
}

// ── What outcomes write ──

/** What a result names. */
export interface OutcomeTextContext {
  /** The visit's doctor ("Dr. Reenal"). */
  doctor: string;
  /** The follow-up date a result names, clinic-local `YYYY-MM-DD`. */
  followUpDate: string;
  /** The visit's `seq` (the feedback form link). */
  visitSeq: number | null;
}

/** The text an outcome stores and sends (`tasks.md:185–227`; Today's two kinds, `today.md:238–242`). */
export interface OutcomeServerText {
  /** The stored result of a closing outcome. */
  result?: (context: OutcomeTextContext) => string;
  /** The stored label of a snoozing outcome ("Snoozed · <label>"). */
  snoozeLabel?: string;
  /** The call note the outcome logs on the person's thread. */
  callNote?: string;
  /** The WhatsApp the outcome sends on the person's thread. */
  whatsApp?: (context: OutcomeTextContext) => string;
}

const text = (value: string) => () => value;

/** Every outcome's server text, keyed `<rule>.<outcome>`. */
export const TASK_OUTCOME_TEXT: Readonly<Record<string, OutcomeServerText>> = {
  'reply.bookedVisit': { result: text('Booked a visit') },
  'reply.notInterested': { result: text('Not interested') },
  'reply.spamOrWrongNumber': { result: text('Marked invalid') },
  'follow.bookedVisit': { result: text('Booked a visit') },
  'follow.callBackTomorrow': {
    result: text('Call back tomorrow'),
    callNote: 'Asked to call back tomorrow',
  },
  'follow.noAnswer': { snoozeLabel: '2 h · no answer', callNote: 'Called · no answer' },
  'follow.notInterested': { result: text('Not interested') },
  'claim.claimIt': {},
  'claim.leaveWithOwner': { snoozeLabel: 'until tomorrow' },
  'failed.retrySend': { result: text('Resent') },
  'failed.calledInstead': {
    result: text('Called instead'),
    callNote: 'Called instead of the failed message',
  },
  'failed.fixTheNumber': {},
  'confirm.confirmedOnCall': { result: text('Confirmed on call') },
  'confirm.moveToAnotherSlot': { result: text('Moving to another slot') },
  'confirm.cancelledByPatient': { result: text('Cancelled by patient') },
  'confirm.noAnswer': {
    snoozeLabel: '2 h · no answer',
    callNote: 'Called to confirm · no answer',
  },
  'arrive.checkedIn': { result: text('Checked in') },
  'arrive.runningLate': { snoozeLabel: '30 min · running late' },
  'arrive.noShow': { result: text('Marked no-show') },
  'rebook.rebooked': { result: text('Rebooked') },
  'rebook.willCallBack': { snoozeLabel: 'until tomorrow' },
  'rebook.notComingBack': { result: text('Not coming back') },
  'feedback.happy': {
    result: text('Happy · review link sent'),
    whatsApp: text('Thank you! Would you leave us a quick Google review?'),
  },
  'feedback.unhappy': {
    result: ({ doctor }) => `Unhappy · call-back task created for ${doctor}`,
  },
  'feedback.logCheckIn': { result: text('Check-in logged') },
  'feedback.sentTheForm': {
    snoozeLabel: 'until tomorrow · form sent',
    whatsApp: ({ visitSeq }) =>
      `How was your visit? Rate us 1–5 here: clinozy.app/f/${visitSeq ?? ''}`,
  },
  'aftercare.logCheckIn': { result: text('Check-in logged') },
  'aftercare.doingWell': { result: text('Doing well · check-in logged') },
  'aftercare.noAnswer': {
    snoozeLabel: '3 h · no answer',
    callNote: 'Aftercare call · no answer',
  },
  'unhappy.calledResolved': { result: text('Resolved on call') },
  'unhappy.offeredReviewVisit': { result: text('Review visit offered') },
  'nextvisit.bookNextVisit': { result: text('Next visit booked') },
  'nextvisit.setFollowUpDate': {
    result: ({ followUpDate }) => `Follow-up set · ${fullDateLabel(followUpDate)}`,
  },
  'nextvisit.noFollowUpNeeded': { result: text('No follow-up needed') },
  'noreply.callNow': { result: text('Called') },
  'noreply.sendOffer': {
    snoozeLabel: 'a week · offer sent',
    whatsApp: text(
      'We miss you at Cresence! Your next session is waiting — reply to pick a slot.',
    ),
  },
  'noreply.notComingBack': { result: text('Not coming back') },
  'manual.done': { result: text('Done') },
  'manual.noAnswer': { snoozeLabel: '3 h · no answer' },
  'manual.bookedVisit': { result: text('Visit booked') },
  'payment.collectAtCheckout': { result: text('Added to today’s checkout') },
  'payment.sendUpiLink': { result: text('UPI link queued on WhatsApp') },
  'payment.called': { result: text('Promise to pay logged') },
  'recall.booked': { result: text('Booked · confirmation queued') },
  'recall.later': { snoozeLabel: '7 days' },
};

/** The stored labels of the drawer's Snooze options (`tasks.md:351`). */
export const TASK_SNOOZE_LABELS = {
  oneHour: '1 hour',
  threeHours: '3 hours',
  tomorrow: 'Tomorrow 10:00',
  nextWeek: 'Next week',
} as const;

/** What "Let Clinozy do it" resolves a task with: its rule's automation (`tasks.md:315–325`). */
export const TASK_AUTOMATION_TEXT: Readonly<Partial<Record<TaskRuleId, string>>> = {
  reply: 'Send the first reply with prices and free slots',
  follow: 'Send a friendly check-in on WhatsApp',
  failed: 'Retry on SMS, then flag for a call',
  confirm: 'Send the reminder and confirm when they reply Yes',
  rebook: 'Offer the next two free slots on WhatsApp',
  feedback: 'Send the feedback form and close on 4–5★',
  aftercare: 'Send the aftercare check-in on WhatsApp and log the reply',
  nextvisit: 'Suggest two slots on WhatsApp and set the follow-up when they pick one',
};

/** What a suggested WhatsApp names. */
export interface SuggestionContext {
  first: string;
  /** The lead's first interest ("treatment" when none). */
  interest: string | null;
  /** The visit, when the task has one. */
  visit: { service: string; day: string; time: string } | null;
}

/**
 * The WhatsApp "Let Clinozy do it" sends and the composer starts from
 * (`tasks.md:348`, H:4327), or null for rules with none. Message language,
 * not UI copy (Q-X2).
 */
export function suggestedMessage(
  rule: TaskRuleId,
  { first, interest, visit }: SuggestionContext,
): string | null {
  switch (rule) {
    case 'reply':
      return `Hi ${first}, thanks for writing to us. Our doctor can see you this week. Shall I book a consultation?`;
    case 'follow':
      return `Hi ${first}, checking in about your ${interest ?? 'treatment'} enquiry. Would you like to book a visit?`;
    case 'confirm':
      return `Hi ${first}, a reminder of your ${
        visit ? `${visit.service} on ${visit.day} at ${visit.time}` : 'visit'
      }. Reply Yes to confirm.`;
    case 'rebook':
      return `Hi ${first}, we missed you. Shall we find a new time for your ${visit?.service ?? 'visit'}?`;
    case 'feedback':
      return `Hi ${first}, how was your ${visit?.service ?? 'visit'}? Rate us 1–5.`;
    case 'aftercare':
      return `Hi ${first}, checking in after your treatment. How does your skin feel today? Any redness or discomfort?`;
    default:
      return null;
  }
}

/** The lead's first interest as a suggestion names it ("LHR"). */
export function interestLabel(interest: LeadInterest | undefined): string | null {
  return interest ? INTEREST_LABELS[interest] : null;
}

/** The system line a closed task leaves on the person's thread (`tasks.md:357`). */
export const taskClosedLine = (result: string) => `Task closed · ${result}`;

/** The system line a reassignment leaves on a lead (`tasks.md:357`). */
export const taskMovedLine = (from: string, to: string) =>
  `Moved from ${from} to ${to} · ${from} stays involved`;

/** The Unhappy patients task feedback "Unhappy" creates (`tasks.md:53, 210`). */
export function unhappyTaskText(input: {
  first: string;
  service: string;
  visitDate: string;
  today: string;
}): { title: string; why: string } {
  return {
    title: `Call ${input.first} back · unhappy`,
    why: `Unhappy after ${input.service} on ${dayLabel(input.visitDate, input.today)} · call before end of day`,
  };
}
