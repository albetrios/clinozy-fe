import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import {
  type BranchHours,
  DEFAULT_BRANCH_HOURS,
  nextBranchWorkingDay,
} from '@/shared/app/branch-hours.ts';

import {
  type LeadStatus,
  type Role,
  ROLE_VALUES,
  TASK_STATUS_VALUES,
  type TaskStatus,
  type Tone,
} from './app-schema.ts';
import { addCivilDays, appInstant, appToday } from './app-time.ts';
import type { AppointmentRow } from './appointments-contracts.ts';
import type { ContactProfile, ContactSummary } from './contacts-contracts.ts';
import type { PatientCheckIn, PatientReview } from './feedback-contracts.ts';
import type { LeadRecord } from './leads-contracts.ts';
import type { TreatmentRecord } from './treatments-contracts.ts';

/*
 * The Tasks domain on clinozy-be (`/app/tasks`, `/app/task-rule-settings`; route map §2 #21–#22,
 * routes-final §10, AS-BUILT #138 and #154). The server runs the rules — it opens, closes, wakes
 * and words the rule tasks ("Reply to Anaya", "Done by Clinozy"), snoozes a "No answer" for three
 * hours and applies an outcome's own effects (a Better check-in, a call-back, a claimed lead); the
 * client reads them. What stays here: the catalogue the screens draw — each type's group, tone and
 * outcome buttons, every outcome a plan of the record writes it makes before the task's own write
 * (research-tasks §2.1, checked against the server's outcomes per rule, D81 TASKS-M2) — the list
 * query, the person a row names, the drawer's read and the write bodies.
 */

// ── The wire ──

type ApiTask = NonNullable<ApiData<'/app/tasks/{task_id}', 'get'>>;
type ApiTaskRow = NonNullable<ApiData<'/app/tasks', 'get'>>[number];
type ApiTaskRuleSetting = NonNullable<ApiData<'/app/task-rule-settings', 'get'>>[number];
/** A new task as `POST /app/tasks` takes it. */
export type ApiTaskCreate = NonNullable<ApiBody<'/app/tasks', 'post'>>;
/** A rule-settings save as `PUT /app/task-rule-settings` takes it. */
export type ApiTaskRuleSettingsSave = NonNullable<
  ApiBody<'/app/task-rule-settings', 'put'>
>;

/** The rules that open tasks, as clinozy-be keys them (15, `medical_rep_visit` included — D81). */
export const TASK_RULE_KEY_VALUES = [
  'reply',
  'failed_message',
  'follow_up',
  'claim',
  'confirm',
  'arrive',
  'rebook',
  'feedback',
  'aftercare',
  'call_back',
  'next_visit',
  'gone_quiet',
  'payment_due',
  'settle_by',
  'medical_rep_visit',
] as const;
/** One rule's key. */
export type TaskRuleKey = (typeof TASK_RULE_KEY_VALUES)[number];

/** How a task came to be: a rule's, a "What’s next" follow-up, or one made by hand. */
const TASK_KIND_VALUES = ['rule', 'follow_up', 'manual'] as const;
/** One task kind. */
type TaskKind = (typeof TASK_KIND_VALUES)[number];

/** The effect codes a task is resolved with; the words are its `result_text`. */
const TASK_OUTCOME_CODE_VALUES = [
  'done',
  'no_answer',
  'doing_well',
  'log_check_in',
  'happy',
  'unhappy',
] as const;
/** One outcome code. */
export type TaskOutcomeCode = (typeof TASK_OUTCOME_CODE_VALUES)[number];

/** A task's priority — the screens offer Normal · High; the API also keeps Low. */
const TASK_PRIORITY_VALUES = ['low', 'normal', 'high'] as const;
/** One priority. */
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number];

const taskContactWire = z.object({
  id: z.string(),
  name: z.string(),
  primary_phone: z.string().nullable(),
  preference_tags: z.array(z.string()),
});

const taskOwnerChangeWire = z.object({
  from_membership_id: z.string().nullable(),
  from_role: z.string().nullable(),
  to_membership_id: z.string().nullable(),
  to_role: z.string().nullable(),
  changed_by_membership_id: z.string().nullable(),
  created_at: z.string(),
});

const taskFieldsWire = {
  id: z.string(),
  kind: z.enum(TASK_KIND_VALUES),
  rule_key: z.enum(TASK_RULE_KEY_VALUES).nullable(),
  title: z.string(),
  why: z.string().nullable(),
  owner_membership_id: z.string().nullable(),
  owner_role: z.enum(ROLE_VALUES).nullable(),
  contact: taskContactWire.nullable(),
  lead_id: z.string().nullable(),
  appointment_id: z.string().nullable(),
  patient_treatment_id: z.string().nullable(),
  patient_check_in_id: z.string().nullable(),
  patient_review_id: z.string().nullable(),
  invoice_id: z.string().nullable(),
  pending_credit_id: z.string().nullable(),
  medical_rep_id: z.string().nullable(),
  branch_id: z.string().nullable(),
  due_at: z.string(),
  status: z.enum(TASK_STATUS_VALUES),
  snoozed_until: z.string().nullable(),
  snooze_label: z.string().nullable(),
  outcome: z.enum(TASK_OUTCOME_CODE_VALUES).nullable(),
  result_text: z.string().nullable(),
  note: z.string().nullable(),
  resolved_at: z.string().nullable(),
  is_resolved_automatically: z.boolean(),
  resolved_by_membership_id: z.string().nullable(),
  priority: z.enum(TASK_PRIORITY_VALUES),
  owner_changes: z.array(taskOwnerChangeWire),
  next_task_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** One task (`GET /app/tasks/:task_id`, and every write's answer). */
export const taskWire = wireSchema<ApiTask>()(z.object(taskFieldsWire));

/** A tasks list row (`GET /app/tasks`). */
export const taskRowWire = wireSchema<ApiTaskRow>()(z.object(taskFieldsWire));

/** One rule's setting (`GET` / `PUT /app/task-rule-settings`). */
export const taskRuleSettingWire = wireSchema<ApiTaskRuleSetting>()(
  z.object({
    rule_key: z.enum(TASK_RULE_KEY_VALUES),
    is_on: z.boolean(),
    is_automatic: z.boolean(),
    can_be_automatic: z.boolean(),
    updated_at: z.string().nullable(),
  }),
);

// ── The catalogue ──

/** The type filter's entry for tasks made by hand — the kinds `follow_up` and `manual`. */
export const TASK_BY_HAND = 'by_hand';

/**
 * What the type filter, the Rules popover and a row's pill name: a rule, or "Follow-ups you set"
 * ({@link TASK_BY_HAND}) — in the popover's order (`tasks.md:42–56`), the rules the design
 * did not draw after it: the payments' two and the medical rep's.
 */
export const TASK_TYPE_VALUES = [
  'reply',
  'follow_up',
  'claim',
  'failed_message',
  'confirm',
  'arrive',
  'rebook',
  'feedback',
  'call_back',
  'aftercare',
  'next_visit',
  'gone_quiet',
  TASK_BY_HAND,
  'payment_due',
  'settle_by',
  'medical_rep_visit',
] as const satisfies readonly (TaskRuleKey | typeof TASK_BY_HAND)[];
/** One task type. */
export type TaskType = (typeof TASK_TYPE_VALUES)[number];

/** The kinds a task made by hand has — what "Follow-ups you set" filters by. */
const TASK_BY_HAND_KINDS = ['follow_up', 'manual'] as const satisfies readonly TaskKind[];

/**
 * The source groups of the type filter and the Rules popover, in order — Leads · Appointments ·
 * Feedback · Treatments · Patients · Team (`tasks.md:178`), then Payments and Medical.
 */
export const TASK_RULE_GROUPS = [
  'leads',
  'appointments',
  'feedback',
  'treatments',
  'patients',
  'team',
  'payments',
  'medical',
] as const;
/** One rule group. */
export type TaskRuleGroup = (typeof TASK_RULE_GROUPS)[number];

/**
 * A span of time from now: minutes, whole days, tomorrow at a clinic-local time, or the task's
 * branch's next opening — its opening time on its next working day after today.
 */
export type TaskTimeSpan =
  | { readonly kind: 'minutes'; readonly minutes: number }
  | { readonly kind: 'days'; readonly days: number }
  | { readonly kind: 'tomorrowAt'; readonly at: string }
  | { readonly kind: 'nextOpening' };

/**
 * A record write an outcome makes before the task's own — each one route of the record the task
 * points at or of its person (research-tasks §2.1).
 */
export type TaskOutcomeStep =
  /** `PATCH /app/leads/:lead_id { status }`. */
  | { readonly type: 'leadStatus'; readonly status: LeadStatus }
  /**
   * `PATCH /app/leads/:lead_id { status: no_response, follow_up_at }` — "No answer": the next try is
   * tomorrow at the clock the task was due (D25).
   */
  | { readonly type: 'leadNoAnswer' }
  /** `POST /app/contacts/:contact_id/activities/log-call { direction: sent, body }` — the outcome's words. */
  | { readonly type: 'logCall' }
  /** The person's newest undelivered message, queued again (`…/activities/:id/resend`). */
  | { readonly type: 'resendFailedMessage' }
  /** The visit's status move: `confirm`, `check-in`, `no-show`, or a cancel the patient asked for. */
  | { readonly type: 'appointment'; readonly action: TaskAppointmentAction }
  /** `PATCH /app/patients/:patient_id { follow_up_at }` — some days from today. */
  | { readonly type: 'patientFollowUp'; readonly days: number };

/** The visit moves an outcome makes. */
export type TaskAppointmentAction = 'confirm' | 'checkIn' | 'noShow' | 'cancel';

/** What an outcome does to the task itself. */
type TaskOutcomeWrite =
  /** `POST …/resolve { outcome, result_text, note }` — the server may snooze it instead (`no_answer`). */
  | { readonly type: 'resolve'; readonly outcome: TaskOutcomeCode }
  /** `POST …/snooze { snoozed_until, snooze_label }`. */
  | { readonly type: 'snooze'; readonly span: TaskTimeSpan }
  /** Nothing ("Fix the number" opens the person's record). */
  | { readonly type: 'none' };

/**
 * A screen an outcome opens next (the outcome table's "Then"): the appointment form (new, a move
 * of this visit, or a rebooking of its service), the review log, the visit or aftercare check-in,
 * the patient file, or the person's own record ("Fix the number").
 */
export type TaskFollowOnForm =
  | 'appointmentNew'
  | 'appointmentMove'
  | 'appointmentRebook'
  | 'reviewLog'
  | 'visitCheckIn'
  | 'aftercareCheckIn'
  | 'patientFile'
  | 'personRecord';

/** One outcome button of a type (the first is the dark one) and the plan it runs. */
export interface TaskOutcomePlan {
  /** Unique within its type; the copy key's segment. */
  readonly id: string;
  /** The record writes, in order, before the task's own write. */
  readonly steps: readonly TaskOutcomeStep[];
  readonly write: TaskOutcomeWrite;
  /** The screen it opens next, if any. */
  readonly opens: TaskFollowOnForm | null;
  /** "What’s next" opens on top. */
  readonly whatsNext: boolean;
}

/** One type of the catalogue. */
export interface TaskTypeDefinition {
  readonly type: TaskType;
  readonly group: TaskRuleGroup;
  readonly tone: Tone;
  readonly outcomes: readonly TaskOutcomePlan[];
}

const DONE = { type: 'resolve', outcome: 'done' } as const;
const NO_ANSWER = { type: 'resolve', outcome: 'no_answer' } as const;
const inMinutes = (minutes: number) =>
  ({ type: 'snooze', span: { kind: 'minutes', minutes } }) as const;
const inDays = (days: number) =>
  ({ type: 'snooze', span: { kind: 'days', days } }) as const;
/**
 * "until tomorrow" — when the task's branch next opens: tomorrow at its opening time, past any day
 * it is closed (KICKOFF §6.10: not +24h).
 */
const UNTIL_TOMORROW = { type: 'snooze', span: { kind: 'nextOpening' } } as const;
const LOG_CALL = { type: 'logCall' } as const;

/** An outcome that writes `write` after `steps`, then shows "What’s next". */
const closes = <Id extends string>(
  id: Id,
  write: TaskOutcomeWrite,
  steps: readonly TaskOutcomeStep[] = [],
  opens: TaskFollowOnForm | null = null,
): TaskOutcomePlan & { readonly id: Id } => ({
  id,
  steps,
  write,
  opens,
  whatsNext: true,
});

/** An outcome that leaves the task in the list for later — no "What’s next". */
const defers = <Id extends string>(
  id: Id,
  write: TaskOutcomeWrite,
  steps: readonly TaskOutcomeStep[] = [],
): TaskOutcomePlan & { readonly id: Id } => ({
  id,
  steps,
  write,
  opens: null,
  whatsNext: false,
});

/**
 * The catalogue — every type's group, tone and outcomes in button order (`tasks.md:42–56,
 * 185–227`, research-tasks §2.1). Each resolve sends one of the outcomes the server offers its
 * rule (D81 TASKS-M2: follow-up and confirm `done` · `no_answer`; feedback `happy` · `unhappy` ·
 * `log_check_in`; aftercare `log_check_in` · `doing_well` · `no_answer`; tasks made by hand
 * `done` · `no_answer`; every other rule `done`); a "No answer" is snoozed three hours by the
 * server.
 */
export const TASK_TYPES = {
  reply: {
    type: 'reply',
    group: 'leads',
    tone: 'lav',
    outcomes: [
      closes(
        'bookedVisit',
        DONE,
        [{ type: 'leadStatus', status: 'follow_up' }],
        'appointmentNew',
      ),
      closes('notInterested', DONE, [{ type: 'leadStatus', status: 'not_interested' }]),
      closes('spamOrWrongNumber', DONE, [{ type: 'leadStatus', status: 'invalid' }]),
    ],
  },
  follow_up: {
    type: 'follow_up',
    group: 'leads',
    tone: 'butter',
    // The lead drawer's outcomes (D25): Booked · No answer · Not interested · Invalid · Lost.
    outcomes: [
      closes('bookedVisit', DONE, [], 'appointmentNew'),
      defers('noAnswer', NO_ANSWER, [{ type: 'leadNoAnswer' }, LOG_CALL]),
      closes('notInterested', DONE, [{ type: 'leadStatus', status: 'not_interested' }]),
      closes('spamOrWrongNumber', DONE, [{ type: 'leadStatus', status: 'invalid' }]),
      closes('lost', DONE, [{ type: 'leadStatus', status: 'lost' }]),
    ],
  },
  claim: {
    type: 'claim',
    group: 'leads',
    tone: 'butter',
    outcomes: [defers('claimIt', DONE), defers('leaveWithOwner', UNTIL_TOMORROW)],
  },
  failed_message: {
    type: 'failed_message',
    group: 'leads',
    tone: 'blush',
    outcomes: [
      closes('retrySend', DONE, [{ type: 'resendFailedMessage' }]),
      closes('calledInstead', DONE, [LOG_CALL]),
      {
        id: 'fixTheNumber',
        steps: [],
        write: { type: 'none' },
        opens: 'personRecord',
        whatsNext: false,
      } as const,
    ],
  },
  confirm: {
    type: 'confirm',
    group: 'appointments',
    tone: 'sky',
    outcomes: [
      closes('confirmedOnCall', DONE, [{ type: 'appointment', action: 'confirm' }]),
      closes('moveToAnotherSlot', DONE, [], 'appointmentMove'),
      closes('cancelledByPatient', DONE, [{ type: 'appointment', action: 'cancel' }]),
      defers('noAnswer', NO_ANSWER, [LOG_CALL]),
    ],
  },
  arrive: {
    type: 'arrive',
    group: 'appointments',
    tone: 'blush',
    outcomes: [
      closes('checkedIn', DONE, [{ type: 'appointment', action: 'checkIn' }]),
      defers('runningLate', inMinutes(30)),
      closes('noShow', DONE, [{ type: 'appointment', action: 'noShow' }]),
    ],
  },
  rebook: {
    type: 'rebook',
    group: 'appointments',
    tone: 'blush',
    outcomes: [
      closes('rebooked', DONE, [], 'appointmentRebook'),
      defers('willCallBack', UNTIL_TOMORROW),
      closes('notComingBack', DONE),
    ],
  },
  feedback: {
    type: 'feedback',
    group: 'feedback',
    tone: 'sage',
    outcomes: [
      closes('happy', { type: 'resolve', outcome: 'happy' }, [], 'reviewLog'),
      closes('unhappy', { type: 'resolve', outcome: 'unhappy' }),
      closes(
        'logCheckIn',
        { type: 'resolve', outcome: 'log_check_in' },
        [],
        'visitCheckIn',
      ),
      defers('sentTheForm', UNTIL_TOMORROW),
    ],
  },
  call_back: {
    type: 'call_back',
    group: 'feedback',
    tone: 'blush',
    outcomes: [
      closes('calledResolved', DONE),
      closes('offeredReviewVisit', DONE, [], 'appointmentNew'),
    ],
  },
  aftercare: {
    type: 'aftercare',
    group: 'treatments',
    tone: 'mint',
    outcomes: [
      closes(
        'logCheckIn',
        { type: 'resolve', outcome: 'log_check_in' },
        [],
        'aftercareCheckIn',
      ),
      closes('doingWell', { type: 'resolve', outcome: 'doing_well' }),
      defers('noAnswer', NO_ANSWER, [LOG_CALL]),
    ],
  },
  next_visit: {
    type: 'next_visit',
    group: 'patients',
    tone: 'sage',
    outcomes: [
      closes('bookNextVisit', DONE, [], 'appointmentNew'),
      closes('setFollowUpDate', DONE, [{ type: 'patientFollowUp', days: 14 }]),
      closes('noFollowUpNeeded', DONE),
    ],
  },
  gone_quiet: {
    type: 'gone_quiet',
    group: 'patients',
    tone: 'peach',
    outcomes: [
      closes('callNow', DONE, [], 'patientFile'),
      defers('sendOffer', inDays(7)),
      closes('notComingBack', DONE),
    ],
  },
  by_hand: {
    type: TASK_BY_HAND,
    group: 'team',
    tone: 'plum',
    outcomes: [
      closes('done', DONE),
      defers('noAnswer', NO_ANSWER),
      closes('bookedVisit', DONE, [], 'appointmentNew'),
    ],
  },
  payment_due: {
    type: 'payment_due',
    group: 'payments',
    tone: 'butter',
    outcomes: [
      closes('collectAtCheckout', DONE),
      closes('sendUpiLink', DONE),
      closes('called', DONE),
    ],
  },
  settle_by: {
    type: 'settle_by',
    group: 'payments',
    tone: 'peach',
    outcomes: [closes('done', DONE)],
  },
  medical_rep_visit: {
    type: 'medical_rep_visit',
    group: 'medical',
    tone: 'sky',
    outcomes: [defers('done', DONE)],
  },
} as const satisfies { readonly [T in TaskType]: TaskTypeDefinition & { type: T } };

/** The outcome ids of one type, as literals. */
export type TaskOutcomeIdOf<T extends TaskType> =
  (typeof TASK_TYPES)[T]['outcomes'][number]['id'];

/** A task's type: its rule, or "Follow-ups you set" for one made by hand. */
export function taskTypeOf(task: Pick<TaskRecord, 'ruleKey'>): TaskType {
  return task.ruleKey ?? TASK_BY_HAND;
}

/** A type's outcome by id, or undefined when the type has no such outcome. */
export function findTaskOutcome(
  type: TaskType,
  outcomeId: string,
): TaskOutcomePlan | undefined {
  const outcomes: readonly TaskOutcomePlan[] = TASK_TYPES[type].outcomes;
  return outcomes.find((candidate) => candidate.id === outcomeId);
}

/** The permission code each record write needs. */
const STEP_CODES: Readonly<Record<TaskOutcomeStep['type'], string>> = {
  leadStatus: 'lead:update',
  leadNoAnswer: 'lead:update',
  logCall: 'contact_activity:create',
  resendFailedMessage: 'contact_activity:update',
  appointment: 'appointment:update',
  patientFollowUp: 'patient:update',
};

/** The permission code a follow-on screen's save needs (none to open a record). */
const FOLLOW_ON_CODES: Readonly<Record<TaskFollowOnForm, string | null>> = {
  appointmentNew: 'appointment:create',
  appointmentRebook: 'appointment:create',
  appointmentMove: 'appointment:update',
  reviewLog: 'patient_review:create',
  visitCheckIn: 'patient:update',
  aftercareCheckIn: 'patient:update',
  patientFile: null,
  personRecord: null,
};

/**
 * The permission codes an outcome needs — its record writes, the task's own write (`task:update`;
 * claiming a lead's task also `lead:update`, D81 TASKS-M3) and the form it opens. A screen hides an
 * outcome the member lacks a code for (research-tasks §7 flag 2).
 */
export function taskOutcomeCodes(type: TaskType, plan: TaskOutcomePlan): string[] {
  const codes = new Set(plan.steps.map((step) => STEP_CODES[step.type]));
  if (plan.write.type !== 'none') codes.add('task:update');
  if (type === 'claim' && plan.write.type === 'resolve') codes.add('lead:update');
  const form = plan.opens ? FOLLOW_ON_CODES[plan.opens] : null;
  if (form) codes.add(form);
  return [...codes];
}

/** The outcome codes that need the person's patient file (`400 outcome` without one). */
const PATIENT_FILE_OUTCOMES: readonly TaskOutcomeCode[] = ['doing_well', 'log_check_in'];

/**
 * Whether an outcome can run for this person: a check-in outcome, or one that sets the patient's
 * follow-up, needs their patient file — the screen hides it without one.
 */
export function taskOutcomeFitsPerson(
  plan: TaskOutcomePlan,
  patientId: string | null,
): boolean {
  if (patientId !== null) return true;
  const resolvesForFile =
    plan.write.type === 'resolve' && PATIENT_FILE_OUTCOMES.includes(plan.write.outcome);
  const setsFollowUp = plan.steps.some((step) => step.type === 'patientFollowUp');
  return !(resolvesForFile || setsFollowUp);
}

/**
 * The outcomes a member can run on a task (research-tasks §7 flag 2, Q5) — the task drawer's and
 * Today's work queue's buttons: each one whose codes they all hold ({@link taskOutcomeCodes} — its
 * record writes, the task's own write, the form it opens) and that fits the person
 * ({@link taskOutcomeFitsPerson}). A member who can run none sees none (a View-as preview holds no
 * code, so it runs none).
 */
export function visibleTaskOutcomes(
  task: Pick<TaskRow, 'type' | 'person'>,
  canCode: (code: string) => boolean,
): readonly TaskOutcomePlan[] {
  const outcomes: readonly TaskOutcomePlan[] = TASK_TYPES[task.type].outcomes;
  const patientId = task.person?.patientId ?? null;
  return outcomes.filter(
    (plan) =>
      taskOutcomeCodes(task.type, plan).every(canCode) &&
      taskOutcomeFitsPerson(plan, patientId),
  );
}

/**
 * The permission codes moving a task needs: `task:update`, and `lead:update` for a lead's task —
 * its lead moves with it (D81 TASKS-M3: `403 missing_permission` otherwise).
 */
export function taskReassignCodes(task: Pick<TaskRecord, 'link'>): string[] {
  return task.link?.kind === 'lead' ? ['task:update', 'lead:update'] : ['task:update'];
}

// ── Time ──

const MINUTE = 60_000;
const DAY = 86_400_000;

/** A clinic-local calendar date and clock time (`YYYY-MM-DD`, `HH:mm`). */
export interface TaskWallTime {
  date: string;
  time: string;
}

/**
 * When a branch next opens after `now`'s clinic day — its opening time on the first working day
 * from tomorrow: "Tomorrow 10:00", or Monday's when Sunday is closed.
 */
export function taskNextOpening(now: Date, hours: BranchHours): TaskWallTime {
  return {
    date: nextBranchWorkingDay(hours, addCivilDays(appToday(now), 1)),
    time: hours.opensAt,
  };
}

/**
 * The instant a span after `now` lands on (clinic-local for "tomorrow at" and the next opening,
 * which reads the task's branch `hours` — the defaults when none are known).
 */
export function taskTimeAfter(
  span: TaskTimeSpan,
  now: Date,
  hours: BranchHours = DEFAULT_BRANCH_HOURS,
): string {
  if (span.kind === 'minutes')
    return new Date(now.getTime() + span.minutes * MINUTE).toISOString();
  if (span.kind === 'days')
    return new Date(now.getTime() + span.days * DAY).toISOString();
  if (span.kind === 'nextOpening') {
    const opening = taskNextOpening(now, hours);
    return appInstant(opening.date, opening.time);
  }
  return appInstant(addCivilDays(appToday(now), 1), span.at);
}

/** The task drawer's Snooze options (`tasks.md:178`). */
export const TASK_SNOOZE_OPTIONS = [
  'oneHour',
  'threeHours',
  'tomorrow',
  'nextWeek',
] as const;
/** One Snooze option. */
export type TaskSnoozeOption = (typeof TASK_SNOOZE_OPTIONS)[number];

/**
 * How long each Snooze option snoozes: "Tomorrow" is the task's branch's next opening — tomorrow at
 * its opening time, clinic-local, past any day it is closed.
 */
const TASK_SNOOZE_SPANS: Readonly<Record<TaskSnoozeOption, TaskTimeSpan>> = {
  oneHour: { kind: 'minutes', minutes: 60 },
  threeHours: { kind: 'minutes', minutes: 180 },
  tomorrow: { kind: 'nextOpening' },
  nextWeek: { kind: 'days', days: 7 },
};

/** When a Snooze option chosen at `now` (an instant) wakes a task of a branch open `hours`. */
export function taskSnoozeUntil(
  option: TaskSnoozeOption,
  now: string,
  hours: BranchHours,
): string {
  return taskTimeAfter(TASK_SNOOZE_SPANS[option], new Date(now), hours);
}

/** "What’s next" When chips (`tasks.md:91`). */
export const TASK_FOLLOW_UP_WHEN = [
  'inThreeHours',
  'tomorrow',
  'inThreeDays',
  'nextWeek',
] as const;
/** One When chip. */
export type TaskFollowUpWhen = (typeof TASK_FOLLOW_UP_WHEN)[number];

/** When the follow-up a When chip sets is due: in 3 h, tomorrow 11:00, in 3 or 7 days (`tasks.md:98`). */
export const TASK_FOLLOW_UP_SPANS: Readonly<Record<TaskFollowUpWhen, TaskTimeSpan>> = {
  inThreeHours: { kind: 'minutes', minutes: 180 },
  tomorrow: { kind: 'tomorrowAt', at: '11:00' },
  inThreeDays: { kind: 'days', days: 3 },
  nextWeek: { kind: 'days', days: 7 },
};

/** How often the list and the drawer read again while open (Today and Tasks, §3.6). */
export const TASKS_REFETCH_MS = 60_000;

// ── Limits (clinozy-be's) ──

/** A task title's limit (New task's Title, What's next). */
export const TASK_TITLE_MAX = 120;

/** A task's why line — New task's Notes. */
export const TASK_WHY_MAX = 280;

/** An outcome's note ("Add a note"). */
const TASK_NOTE_MAX = 280;

/** An outcome's result words, as the server keeps them. */
const TASK_RESULT_MAX = 200;

/** A snooze's label ("Running late", "Tomorrow 10:00"). */
const TASK_SNOOZE_LABEL_MAX = 40;

/** Words clamped to a server limit, trimmed — `undefined` when nothing is left. */
function clampText(text: string | null | undefined, max: number): string | undefined {
  const clamped = text?.trim().slice(0, max).trim();
  return clamped === '' ? undefined : clamped;
}

/** An outcome's words as `result_text` takes them (1–200). */
export const taskResultTextOf = (text: string) => clampText(text, TASK_RESULT_MAX);

/** A snooze's words as `snooze_label` takes them (1–40). */
export const taskSnoozeLabelOf = (text: string | null | undefined) =>
  clampText(text, TASK_SNOOZE_LABEL_MAX);

/** An outcome's note as `note` takes it (1–280). */
export const taskNoteOf = (text: string | null | undefined) =>
  clampText(text, TASK_NOTE_MAX);

// ── The list query ──

/** The list's views, "To do · Snoozed · Done" — To do is the API's `open`. */
export const TASK_TABS = ['open', 'snoozed', 'done'] as const;
/** One view. */
export type TaskTab = (typeof TASK_TABS)[number];

/** "Mine" = mine and unowned in my roles' queues; "Everyone" = every owner (Appendix F, TK3). */
export const TASK_SCOPES = ['mine', 'everyone'] as const;
/** One scope. */
export type TaskScope = (typeof TASK_SCOPES)[number];

/** The search field's limit (`tasks.md:66`). */
const TASK_SEARCH_MAX = 80;

/** A list read: the view, the scope, the type filter, the search and the header's branches. */
export interface TaskListQuery {
  tab: TaskTab;
  scope: TaskScope;
  /** Rules and "Follow-ups you set" — any of them (none: every type). */
  type: TaskType[];
  q: string;
  /**
   * The header's branches (D32) — the tasks filed under any of them, and those under none;
   * absent: every branch.
   */
  branchIds?: string[];
}

/** A list query as callers write it (every field optional). */
export type TaskListQueryInput = Partial<TaskListQuery>;

/**
 * A list query with its defaults filled (To do, Mine), the search trimmed to its limit, the
 * type filter deduplicated in the catalogue's order and the branches sorted — so equal queries
 * share one cache entry.
 */
export function normalizeTaskListQuery(query: TaskListQueryInput = {}): TaskListQuery {
  const types = new Set(query.type ?? []);
  const branchIds = [...new Set(query.branchIds ?? [])].sort((a, b) =>
    a.localeCompare(b),
  );
  return {
    tab: query.tab ?? 'open',
    scope: query.scope ?? 'mine',
    type: TASK_TYPE_VALUES.filter((type) => types.has(type)),
    q: (query.q ?? '').trim().slice(0, TASK_SEARCH_MAX).trim(),
    ...(branchIds.length > 0 ? { branchIds } : {}),
  };
}

/**
 * The type filter as the API takes it (D81 T6): the rules as `rule_key`, "Follow-ups you set" as
 * `kind=follow_up,manual` — the server matches a task of any rule or kind named.
 */
export function taskTypeQueryOf(types: readonly TaskType[]): {
  rule_key?: string;
  kind?: string;
} {
  const rules = types.filter((type): type is TaskRuleKey => type !== TASK_BY_HAND);
  return {
    ...(rules.length > 0 ? { rule_key: rules.join(',') } : {}),
    ...(types.includes(TASK_BY_HAND) ? { kind: TASK_BY_HAND_KINDS.join(',') } : {}),
  };
}

// ── The rooms' shapes ──

/** What a task points at — the one record link it carries (route map §2 #21). */
const TASK_LINK_KINDS = [
  'lead',
  'appointment',
  'treatment',
  'checkIn',
  'review',
  'invoice',
  'pendingCredit',
  'medicalRep',
] as const;
/** What kind of record a task points at. */
export type TaskLinkKind = (typeof TASK_LINK_KINDS)[number];

/** The record a task points at. */
interface TaskLink {
  kind: TaskLinkKind;
  id: string;
}

/** Each link kind's column. */
const LINK_COLUMNS = {
  lead: 'lead_id',
  appointment: 'appointment_id',
  treatment: 'patient_treatment_id',
  checkIn: 'patient_check_in_id',
  review: 'patient_review_id',
  invoice: 'invoice_id',
  pendingCredit: 'pending_credit_id',
  medicalRep: 'medical_rep_id',
} as const satisfies Record<TaskLinkKind, keyof ApiTaskCreate>;

/** The person a task is about, as the task names them. */
export interface TaskContact {
  /** The contact's id (`con_…`). */
  id: string;
  name: string;
  /** Their primary number, E.164. */
  phone: string | null;
  /** Their preferences — "No calls" warns before a call (10.A.6). */
  preferenceTags: string[];
}

/** A row's person: the task's, with what their contact record adds (one read per page). */
export interface TaskPerson extends TaskContact {
  firstName: string;
  /** "C-12345"; null when their contact could not be read. */
  contactNumber: number | null;
  /** Their patient file — the "P" badge, "Patient #3508"; the check-in outcomes need it. */
  patientId: string | null;
  patientNumber: number | null;
  /** Their open lead — "Open lead". */
  openLeadId: string | null;
}

/** One move of a task's owner, newest first (the server keeps the last five). */
interface TaskOwnerChange {
  fromId: string | null;
  fromRole: Role | null;
  toId: string | null;
  toRole: Role | null;
  changedById: string | null;
  at: string;
}

/** A task as clinozy-be keeps it. */
export interface TaskRecord {
  /** The task's id (`task_…`). */
  id: string;
  kind: TaskKind;
  /** Its rule; null for one made by hand. */
  ruleKey: TaskRuleKey | null;
  /** Its catalogue entry: the rule, or "Follow-ups you set". */
  type: TaskType;
  /** The server's words for a rule task ("Reply to Anaya"); the member's for one made by hand. */
  title: string;
  why: string | null;
  /** The member it is assigned to (`mem_…`) — or none, while it waits in {@link ownerRole}'s queue. */
  ownerId: string | null;
  /** The role queue an unowned task waits in ("Front desk"). */
  ownerRole: Role | null;
  contact: TaskContact | null;
  link: TaskLink | null;
  branchId: string | null;
  dueAt: string;
  status: TaskStatus;
  snoozedUntil: string | null;
  /** The snooze's words ("No answer", "Tomorrow 10:00"). */
  snoozeLabel: string | null;
  outcome: TaskOutcomeCode | null;
  /** What closed it, in words ("Booked a visit", "Done by Clinozy"). */
  resultText: string | null;
  note: string | null;
  resolvedAt: string | null;
  /** The server closed it ("Done by Clinozy"): its record changed, or a rule did it. */
  isResolvedAutomatically: boolean;
  resolvedById: string | null;
  priority: TaskPriority;
  ownerChanges: TaskOwnerChange[];
  /** The follow-up a resolve with `next` made. */
  nextTaskId: string | null;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** A list row: the task with its person. */
export interface TaskRow extends TaskRecord {
  /** Null for a task about nobody; the contact's own fields stay when their record can't be read. */
  person: TaskPerson | null;
}

/** The record the drawer reads by the task's link (the ones the member may read). */
export type TaskSourceRecord =
  | { kind: 'lead'; lead: LeadRecord }
  | { kind: 'appointment'; appointment: AppointmentRow }
  | { kind: 'treatment'; treatment: TreatmentRecord }
  | { kind: 'checkIn'; checkIn: PatientCheckIn }
  | { kind: 'review'; review: PatientReview };

/** The message the drawer quotes — their unreplied one, or the undelivered one "Retry send" queues. */
export interface TaskQuote {
  /** The activity's id — what a resend points at. */
  activityId: string;
  text: string;
  at: string;
}

/** The drawer's read: the row, the record it points at, the message it quotes. */
export interface TaskDetail {
  task: TaskRow;
  /** Null without a link, a link the drawer does not read, or one the member may not read. */
  source: TaskSourceRecord | null;
  quote: TaskQuote | null;
}

/** One rule's setting: on (its tasks open) and handed to Clinozy. */
interface TaskRuleSetting {
  isOn: boolean;
  isAutomatic: boolean;
  /** Clinozy can do this rule's tasks (`confirm`, `feedback`, `payment_due`, `gone_quiet`). */
  canBeAutomatic: boolean;
  updatedAt: string | null;
}

/** Every rule's setting, by rule (a rule the server did not answer for reads as on). */
export type TaskRuleSettings = Partial<Record<TaskRuleKey, TaskRuleSetting>>;

/** A change to one rule's setting. */
export interface TaskRuleSettingChange {
  ruleKey: TaskRuleKey;
  isOn?: boolean;
  isAutomatic?: boolean;
}

// ── Mappers ──

const isRole = (value: string | null): value is Role =>
  value !== null && (ROLE_VALUES as readonly string[]).includes(value);

/** The one link a task carries, by the first non-null column. */
function linkOf(row: z.output<typeof taskWire>): TaskLink | null {
  for (const kind of TASK_LINK_KINDS) {
    const id = row[LINK_COLUMNS[kind]];
    if (id) return { kind, id };
  }
  return null;
}

/** A task as the rooms read it. */
export function toTaskRecord(row: z.output<typeof taskWire>): TaskRecord {
  return {
    id: row.id,
    kind: row.kind,
    ruleKey: row.rule_key,
    type: row.rule_key ?? TASK_BY_HAND,
    title: row.title,
    why: row.why,
    ownerId: row.owner_membership_id,
    ownerRole: row.owner_role,
    contact: row.contact
      ? {
          id: row.contact.id,
          name: row.contact.name,
          phone: row.contact.primary_phone,
          preferenceTags: row.contact.preference_tags,
        }
      : null,
    link: linkOf(row),
    branchId: row.branch_id,
    dueAt: row.due_at,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    snoozeLabel: row.snooze_label,
    outcome: row.outcome,
    resultText: row.result_text,
    note: row.note,
    resolvedAt: row.resolved_at,
    isResolvedAutomatically: row.is_resolved_automatically,
    resolvedById: row.resolved_by_membership_id,
    priority: row.priority,
    ownerChanges: row.owner_changes.map((change) => ({
      fromId: change.from_membership_id,
      fromRole: isRole(change.from_role) ? change.from_role : null,
      toId: change.to_membership_id,
      toRole: isRole(change.to_role) ? change.to_role : null,
      changedById: change.changed_by_membership_id,
      at: change.created_at,
    })),
    nextTaskId: row.next_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The first word of a name — the person's first name when their record can't be read. */
const firstWordOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * A task's person with what their contact record adds — the first name, the contact and patient
 * numbers, the patient file and the open lead; without the record, the task's own fields.
 */
export function toTaskPerson(
  contact: TaskContact,
  record: (ContactSummary & Pick<ContactProfile, 'patientNumber'>) | undefined,
): TaskPerson {
  return {
    ...contact,
    firstName: record?.firstName ?? firstWordOf(contact.name),
    contactNumber: record?.contactNumber ?? null,
    patientId: record?.patientId ?? null,
    patientNumber: record?.patientNumber ?? null,
    openLeadId: record?.openLeadId ?? null,
  };
}

/** A row: the task with its person, from the people a page read. */
export function toTaskRow(
  task: TaskRecord,
  people: ReadonlyMap<string, ContactSummary & Pick<ContactProfile, 'patientNumber'>>,
): TaskRow {
  return {
    ...task,
    person: task.contact ? toTaskPerson(task.contact, people.get(task.contact.id)) : null,
  };
}

/** Every rule's setting from the API's rows. */
export function toTaskRuleSettings(
  rows: readonly z.output<typeof taskRuleSettingWire>[],
): TaskRuleSettings {
  return Object.fromEntries(
    rows.map((row) => [
      row.rule_key,
      {
        isOn: row.is_on,
        isAutomatic: row.is_automatic,
        canBeAutomatic: row.can_be_automatic,
        updatedAt: row.updated_at,
      },
    ]),
  );
}

// ── Writes ──

/** Who a task goes to: a member, or a role's queue. */
export type TaskAssignee = { membershipId: string } | { role: Role };

/** The owner as `POST /app/tasks` and `…/reassign` take it — exactly one of the two. */
export function taskOwnerBodyOf(
  assignee: TaskAssignee,
): Pick<ApiTaskCreate, 'owner_membership_id' | 'owner_role'> {
  return 'membershipId' in assignee
    ? { owner_membership_id: assignee.membershipId }
    : { owner_role: assignee.role };
}

/** What New task and "What’s next" write. */
export interface TaskFields {
  title: string;
  why: string | null;
  dueAt: string;
  assignee: TaskAssignee;
  priority: TaskPriority;
  /** The person it is about — the task inherits their branch from the record it points at. */
  contactId: string | null;
  /** The record it points at (What's next: the closed task's). */
  link: TaskLink | null;
}

/** A new task's body: the fields, its person and its one record link. */
export function taskCreateBodyOf(fields: TaskFields): ApiTaskCreate {
  const why = fields.why?.trim();
  const body: ApiTaskCreate = {
    title: fields.title.trim(),
    due_at: fields.dueAt,
    ...taskOwnerBodyOf(fields.assignee),
    ...(why ? { why } : {}),
    ...(fields.contactId ? { contact_id: fields.contactId } : {}),
    priority: fields.priority,
  };
  if (fields.link) body[LINK_COLUMNS[fields.link.kind]] = fields.link.id;
  return body;
}

/** A rule-settings save's body. */
export function taskRuleSettingsBodyOf(
  changes: readonly TaskRuleSettingChange[],
): ApiTaskRuleSettingsSave {
  return {
    rules: changes.map((change) => ({
      rule_key: change.ruleKey,
      ...(change.isOn === undefined ? {} : { is_on: change.isOn }),
      ...(change.isAutomatic === undefined ? {} : { is_automatic: change.isAutomatic }),
    })),
  };
}
