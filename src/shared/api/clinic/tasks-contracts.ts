import { z } from 'zod';

import {
  appointmentSchema,
  type AppointmentStatus,
  invoiceSchema,
  leadMessageSchema,
  leadSchema,
  type LeadStatus,
  patientSchema,
  type TaskKind,
  taskKindSchema,
  type TaskOutcome,
  taskSchema,
  type TaskSource,
  type Tone,
  treatmentSchema,
  userSchema,
} from './clinic-schema.ts';
import { addCivilDays, clinicInstant, clinicToday } from './clinic-time.ts';

/**
 * The Tasks domain beyond the generated contract (KICKOFF §6.10, Q-T3): the
 * rule catalogue, each rule's outcomes and what follows them, the list query,
 * and the plan-only fields a task record carries until clinozy-be serves them
 * (Appendix F — "a rule key per task", "~40 outcomes (vs 5)", `resolvedBy`,
 * result text, note, the snooze label, reassign history; REPLACE_WITH_API).
 *
 * The contract's `task_kind` has seven values and `task_outcome` five
 * (`schema-routes.md` S:1498–1531); every rule maps onto one kind and every
 * outcome onto one contract outcome (or none). The rule's copy — label,
 * description, automation, how-to steps, outcome labels and effect lines — is
 * UI copy in the `tasks` namespace (`src/shared/clinic/task-rules.constants.ts`);
 * what the server writes (titles, why lines, results, snooze labels) is data.
 */

// ── Rules ──

/**
 * The rules that create tasks, in the Rules popover's order (`tasks.md:42–56`,
 * H:4224–4236), then the Today work queue's two kinds the plan adds to the
 * catalogue — Payment due and Recall (`today.md:238–242`, §6.2, Appendix F).
 */
export const TASK_RULE_IDS = [
  'reply',
  'follow',
  'claim',
  'failed',
  'confirm',
  'arrive',
  'rebook',
  'feedback',
  'aftercare',
  'unhappy',
  'nextvisit',
  'noreply',
  'manual',
  'payment',
  'recall',
] as const;
/** Zod enum of the rule ids. */
export const taskRuleIdSchema = z.enum(TASK_RULE_IDS);
/** One rule id. */
export type TaskRuleId = z.infer<typeof taskRuleIdSchema>;

/**
 * The source groups of the type filter and the Rules popover, in order — Leads ·
 * Appointments · Feedback · Treatments · Patients · Team (`tasks.md:178`) — and
 * Payments for the Payment due kind (`task_source` `invoice` reads "Payments").
 */
export const TASK_RULE_GROUPS = [
  'leads',
  'appointments',
  'feedback',
  'treatments',
  'patients',
  'team',
  'payments',
] as const;
/** One rule group. */
export type TaskRuleGroup = (typeof TASK_RULE_GROUPS)[number];

/** A span of time from now: minutes, whole days, or tomorrow at a clinic-local time. */
export type TaskTimeSpan =
  | { readonly kind: 'minutes'; readonly minutes: number }
  | { readonly kind: 'days'; readonly days: number }
  | { readonly kind: 'tomorrowAt'; readonly at: string };

/**
 * When a rule's task is due (the rules table's "Due" column, `tasks.md:42–56`).
 * `picked` — the member chose it (What's next, New task, the Today seeds).
 */
export type TaskDueRule =
  /** Minutes after the person's message (Unreplied messages: 30). */
  | { readonly from: 'message'; readonly minutes: number }
  /** The lead's follow-up date at a clinic-local time. */
  | { readonly from: 'followUpDate'; readonly at: string }
  /** Minutes from when the rule fires (negative: already overdue). */
  | { readonly from: 'now'; readonly minutes: number }
  /**
   * Minutes from the visit's start; with `beyondHours`, a visit at least that
   * far away is due the day before at `dayBeforeAt` instead.
   */
  | {
      readonly from: 'visitStart';
      readonly minutes: number;
      readonly beyondHours?: number;
      readonly dayBeforeAt?: string;
    }
  /** Days after the visit's day, at a clinic-local time. */
  | { readonly from: 'visitDay'; readonly days: number; readonly at: string }
  /** The treatment's day plus its aftercare call days, at a clinic-local time. */
  | { readonly from: 'treatmentDay'; readonly at: string }
  /** Today at a clinic-local time. */
  | { readonly from: 'today'; readonly at: string }
  | { readonly from: 'picked' };

/**
 * Who a rule's task goes to (the rules table's "Owner" column): the lead's
 * owner, nobody ("Anyone"), the signed-in member, the visit's doctor, or
 * whoever the member picked.
 */
export type TaskOwnerRule = 'leadOwner' | 'nobody' | 'viewer' | 'visitDoctor' | 'picked';

/** A record write an outcome makes (the outcome table's "What it writes", `tasks.md:185–227`). */
export type TaskOutcomeEffect =
  /** The lead's status changes. */
  | { readonly type: 'leadStatus'; readonly status: LeadStatus }
  /** The lead's follow-up moves to tomorrow at a clinic-local time. */
  | { readonly type: 'leadFollowUpTomorrow'; readonly at: string }
  /** A call note joins the person's thread. */
  | { readonly type: 'logCall' }
  /** The signed-in member becomes the lead's owner; the old owner stays involved. */
  | { readonly type: 'claimLead' }
  /** The undelivered message is sent again on its channel. */
  | { readonly type: 'resendMessage' }
  /** The visit's status changes. */
  | { readonly type: 'appointmentStatus'; readonly status: AppointmentStatus }
  /** A WhatsApp goes out on the person's thread. */
  | { readonly type: 'sendWhatsApp' }
  /** An Unhappy patients task is created for the visit's doctor. */
  | { readonly type: 'unhappyTask' }
  /** A quick "Better" aftercare check-in is logged. */
  | { readonly type: 'betterCheckIn' }
  /** The patient's follow-up is set some days from today. */
  | { readonly type: 'patientFollowUp'; readonly days: number };

/** What an outcome does to the task itself. */
export type TaskOutcomeDisposition =
  /** Closes it with the outcome's result. */
  | { readonly type: 'close' }
  /** Snoozes it. */
  | { readonly type: 'snooze'; readonly span: TaskTimeSpan }
  /**
   * Leaves it as it is: "Fix the number" writes nothing, and "Claim it" changes
   * the lead — the rule then closes the task itself.
   */
  | { readonly type: 'none' };

/**
 * The screens an outcome opens next (the outcome table's "Then"): the
 * appointment form (new, a move of this visit, or a rebooking of its service),
 * the review log, the visit or aftercare check-in, the patient file, or the
 * person's own record ("Fix the number": the patient file or the lead drawer).
 */
export const TASK_FOLLOW_ON_FORMS = [
  'appointmentNew',
  'appointmentMove',
  'appointmentRebook',
  'reviewLog',
  'visitCheckIn',
  'aftercareCheckIn',
  'patientFile',
  'personRecord',
] as const;
/** One follow-on screen. */
export type TaskFollowOnForm = (typeof TASK_FOLLOW_ON_FORMS)[number];

/** What follows an outcome: a screen to open (or none) and whether "What’s next" opens on top. */
export interface TaskOutcomeFollowOn {
  readonly opens: TaskFollowOnForm | null;
  readonly whatsNext: boolean;
}

/** One outcome button of a rule (the first is the dark one). */
export interface TaskRuleOutcome {
  /** Unique within its rule; the i18n key segment and the stored `ruleOutcome` suffix. */
  readonly id: string;
  /** The contract's `task_outcome` the write carries — null where the contract has none. */
  readonly contractOutcome: TaskOutcome | null;
  readonly disposition: TaskOutcomeDisposition;
  readonly effects: readonly TaskOutcomeEffect[];
  readonly followOn: TaskOutcomeFollowOn;
}

/** One rule of the catalogue. */
export interface TaskRuleDefinition {
  readonly id: TaskRuleId;
  readonly group: TaskRuleGroup;
  /** The contract kind its tasks carry (the contract has seven; the rule is Appendix F). */
  readonly kind: TaskKind;
  /** The contract source its tasks point at — null for patient-sourced and picked ones. */
  readonly sourceType: TaskSource | null;
  readonly tone: Tone;
  /** In the Rules popover and the type filter: the 13 designed rules, not Today's two kinds. */
  readonly listed: boolean;
  /** Created and closed by the rule job; false when an outcome or a member creates the task. */
  readonly derived: boolean;
  /** Clinozy can do it ("Let Clinozy handle", "Let Clinozy do it"). */
  readonly automation: boolean;
  readonly due: TaskDueRule;
  readonly owner: TaskOwnerRule;
  readonly outcomes: readonly TaskRuleOutcome[];
}

const whatsNext = { opens: null, whatsNext: true } as const;
const nothingNext = { opens: null, whatsNext: false } as const;
const close = { type: 'close' } as const;
const inMinutes = (minutes: number) =>
  ({ type: 'snooze', span: { kind: 'minutes', minutes } }) as const;
const inDays = (days: number) =>
  ({ type: 'snooze', span: { kind: 'days', days } }) as const;
/** "until tomorrow" — tomorrow morning, clinic-local (KICKOFF §6.10: not +24h). */
const untilTomorrow = {
  type: 'snooze',
  span: { kind: 'tomorrowAt', at: '10:00' },
} as const;

/**
 * The rule catalogue — every rule's group, kind, tone, due and owner rules and
 * its outcomes in button order, verbatim from `tasks.md:42–56` and the outcome
 * table `tasks.md:185–227` (H:4224–4236, H:4293); Payment due and Recall carry
 * the Today work queue's designed outcomes (`today.md:238–242`).
 */
export const TASK_RULES = {
  reply: {
    id: 'reply',
    group: 'leads',
    kind: 'follow_up',
    sourceType: 'lead',
    tone: 'lav',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'message', minutes: 30 },
    owner: 'leadOwner',
    outcomes: [
      {
        id: 'bookedVisit',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'leadStatus', status: 'follow_up' }],
        followOn: { opens: 'appointmentNew', whatsNext: true },
      },
      {
        id: 'notInterested',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'leadStatus', status: 'not_interested' }],
        followOn: whatsNext,
      },
      {
        id: 'spamOrWrongNumber',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'leadStatus', status: 'invalid' }],
        followOn: whatsNext,
      },
    ],
  },
  follow: {
    id: 'follow',
    group: 'leads',
    kind: 'follow_up',
    sourceType: 'lead',
    tone: 'butter',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'followUpDate', at: '11:00' },
    owner: 'leadOwner',
    outcomes: [
      {
        id: 'bookedVisit',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'appointmentNew', whatsNext: true },
      },
      {
        id: 'callBackTomorrow',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'leadFollowUpTomorrow', at: '11:00' }, { type: 'logCall' }],
        followOn: whatsNext,
      },
      {
        id: 'noAnswer',
        contractOutcome: 'no_answer',
        disposition: inMinutes(120),
        effects: [{ type: 'logCall' }],
        followOn: nothingNext,
      },
      {
        id: 'notInterested',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'leadStatus', status: 'not_interested' }],
        followOn: whatsNext,
      },
    ],
  },
  claim: {
    id: 'claim',
    group: 'leads',
    kind: 'follow_up',
    sourceType: 'lead',
    tone: 'butter',
    listed: true,
    derived: true,
    automation: false,
    due: { from: 'now', minutes: 180 },
    owner: 'nobody',
    outcomes: [
      {
        id: 'claimIt',
        contractOutcome: null,
        disposition: { type: 'none' },
        effects: [{ type: 'claimLead' }],
        followOn: nothingNext,
      },
      {
        id: 'leaveWithOwner',
        contractOutcome: null,
        disposition: untilTomorrow,
        effects: [],
        followOn: nothingNext,
      },
    ],
  },
  failed: {
    id: 'failed',
    group: 'leads',
    kind: 'follow_up',
    sourceType: 'lead',
    tone: 'blush',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'now', minutes: -25 },
    owner: 'leadOwner',
    outcomes: [
      {
        id: 'retrySend',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'resendMessage' }],
        followOn: whatsNext,
      },
      {
        id: 'calledInstead',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'logCall' }],
        followOn: whatsNext,
      },
      {
        id: 'fixTheNumber',
        contractOutcome: null,
        disposition: { type: 'none' },
        effects: [],
        followOn: { opens: 'personRecord', whatsNext: false },
      },
    ],
  },
  confirm: {
    id: 'confirm',
    group: 'appointments',
    kind: 'confirm_visit',
    sourceType: 'appointment',
    tone: 'sky',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'visitStart', minutes: -120, beyondHours: 20, dayBeforeAt: '18:00' },
    owner: 'viewer',
    outcomes: [
      {
        id: 'confirmedOnCall',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'appointmentStatus', status: 'confirmed' }],
        followOn: whatsNext,
      },
      {
        id: 'moveToAnotherSlot',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'appointmentMove', whatsNext: true },
      },
      {
        id: 'cancelledByPatient',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'appointmentStatus', status: 'cancelled' }],
        followOn: whatsNext,
      },
      {
        id: 'noAnswer',
        contractOutcome: 'no_answer',
        disposition: inMinutes(120),
        effects: [{ type: 'logCall' }],
        followOn: nothingNext,
      },
    ],
  },
  arrive: {
    id: 'arrive',
    group: 'appointments',
    kind: 'confirm_visit',
    sourceType: 'appointment',
    tone: 'blush',
    listed: true,
    derived: true,
    automation: false,
    due: { from: 'visitStart', minutes: 15 },
    owner: 'viewer',
    outcomes: [
      {
        id: 'checkedIn',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'appointmentStatus', status: 'checked_in' }],
        followOn: whatsNext,
      },
      {
        id: 'runningLate',
        contractOutcome: null,
        disposition: inMinutes(30),
        effects: [],
        followOn: nothingNext,
      },
      {
        id: 'noShow',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'appointmentStatus', status: 'no_show' }],
        followOn: whatsNext,
      },
    ],
  },
  rebook: {
    id: 'rebook',
    group: 'appointments',
    kind: 'follow_up',
    sourceType: 'appointment',
    tone: 'blush',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'visitDay', days: 1, at: '11:00' },
    owner: 'viewer',
    outcomes: [
      {
        id: 'rebooked',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'appointmentRebook', whatsNext: true },
      },
      {
        id: 'willCallBack',
        contractOutcome: null,
        disposition: untilTomorrow,
        effects: [],
        followOn: nothingNext,
      },
      {
        id: 'notComingBack',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
    ],
  },
  feedback: {
    id: 'feedback',
    group: 'feedback',
    kind: 'aftercare_call',
    sourceType: 'appointment',
    tone: 'sage',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'today', at: '12:00' },
    owner: 'viewer',
    outcomes: [
      {
        id: 'happy',
        contractOutcome: 'happy',
        disposition: close,
        effects: [{ type: 'sendWhatsApp' }],
        followOn: { opens: 'reviewLog', whatsNext: true },
      },
      {
        id: 'unhappy',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'unhappyTask' }],
        followOn: whatsNext,
      },
      {
        id: 'logCheckIn',
        contractOutcome: 'log_check_in',
        disposition: close,
        effects: [],
        followOn: { opens: 'visitCheckIn', whatsNext: true },
      },
      {
        id: 'sentTheForm',
        contractOutcome: null,
        disposition: untilTomorrow,
        effects: [{ type: 'sendWhatsApp' }],
        followOn: nothingNext,
      },
    ],
  },
  aftercare: {
    id: 'aftercare',
    group: 'treatments',
    kind: 'aftercare_call',
    sourceType: 'treatment',
    tone: 'mint',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'treatmentDay', at: '11:00' },
    owner: 'viewer',
    outcomes: [
      {
        id: 'logCheckIn',
        contractOutcome: 'log_check_in',
        disposition: close,
        effects: [],
        followOn: { opens: 'aftercareCheckIn', whatsNext: true },
      },
      {
        id: 'doingWell',
        contractOutcome: 'doing_well',
        disposition: close,
        effects: [{ type: 'betterCheckIn' }],
        followOn: whatsNext,
      },
      {
        id: 'noAnswer',
        contractOutcome: 'no_answer',
        disposition: inMinutes(180),
        effects: [{ type: 'logCall' }],
        followOn: nothingNext,
      },
    ],
  },
  unhappy: {
    id: 'unhappy',
    group: 'feedback',
    kind: 'callback',
    sourceType: 'appointment',
    tone: 'blush',
    listed: true,
    derived: false,
    automation: false,
    due: { from: 'today', at: '18:00' },
    owner: 'visitDoctor',
    outcomes: [
      {
        id: 'calledResolved',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
      {
        id: 'offeredReviewVisit',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'appointmentNew', whatsNext: true },
      },
    ],
  },
  nextvisit: {
    id: 'nextvisit',
    group: 'patients',
    kind: 'follow_up',
    sourceType: null,
    tone: 'sage',
    listed: true,
    derived: true,
    automation: true,
    due: { from: 'today', at: '17:00' },
    owner: 'viewer',
    outcomes: [
      {
        id: 'bookNextVisit',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'appointmentNew', whatsNext: true },
      },
      {
        id: 'setFollowUpDate',
        contractOutcome: 'done',
        disposition: close,
        effects: [{ type: 'patientFollowUp', days: 14 }],
        followOn: whatsNext,
      },
      {
        id: 'noFollowUpNeeded',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
    ],
  },
  noreply: {
    id: 'noreply',
    group: 'patients',
    kind: 'follow_up',
    sourceType: null,
    tone: 'peach',
    listed: true,
    derived: true,
    automation: false,
    due: { from: 'today', at: '12:00' },
    owner: 'viewer',
    outcomes: [
      {
        id: 'callNow',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'patientFile', whatsNext: true },
      },
      {
        id: 'sendOffer',
        contractOutcome: null,
        disposition: inDays(7),
        effects: [{ type: 'sendWhatsApp' }],
        followOn: nothingNext,
      },
      {
        id: 'notComingBack',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
    ],
  },
  manual: {
    id: 'manual',
    group: 'team',
    kind: 'manual',
    sourceType: null,
    tone: 'plum',
    listed: true,
    derived: false,
    automation: false,
    due: { from: 'picked' },
    owner: 'picked',
    outcomes: [
      {
        id: 'done',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
      {
        id: 'noAnswer',
        contractOutcome: 'no_answer',
        disposition: inMinutes(180),
        effects: [],
        followOn: nothingNext,
      },
      {
        id: 'bookedVisit',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: { opens: 'appointmentNew', whatsNext: true },
      },
    ],
  },
  payment: {
    id: 'payment',
    group: 'payments',
    kind: 'payment_reminder',
    sourceType: 'invoice',
    tone: 'butter',
    listed: false,
    derived: false,
    automation: false,
    due: { from: 'picked' },
    owner: 'picked',
    outcomes: [
      {
        id: 'collectAtCheckout',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
      {
        id: 'sendUpiLink',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
      {
        id: 'called',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
    ],
  },
  recall: {
    id: 'recall',
    group: 'patients',
    kind: 'follow_up',
    sourceType: null,
    tone: 'lav',
    listed: false,
    derived: false,
    automation: false,
    due: { from: 'picked' },
    owner: 'picked',
    outcomes: [
      {
        id: 'booked',
        contractOutcome: 'done',
        disposition: close,
        effects: [],
        followOn: whatsNext,
      },
      {
        id: 'later',
        contractOutcome: null,
        disposition: inDays(7),
        effects: [],
        followOn: nothingNext,
      },
    ],
  },
} as const satisfies { readonly [R in TaskRuleId]: TaskRuleDefinition & { id: R } };

/** The outcome ids of one rule, as literals. */
export type TaskOutcomeIdOf<R extends TaskRuleId> =
  (typeof TASK_RULES)[R]['outcomes'][number]['id'];

/** The stored `ruleOutcome` of "Let Clinozy do it" (`<rule>.clinozy`). */
export const TASK_CLINOZY_OUTCOME = 'clinozy';

/** The stored `ruleOutcome` key of a rule's outcome: `<rule>.<outcome>`. */
export function taskOutcomeKey(rule: TaskRuleId, outcome: string): string {
  return `${rule}.${outcome}`;
}

/** A rule's outcome by id, or undefined when the rule has no such outcome. */
export function findTaskOutcome(
  rule: TaskRuleId,
  outcome: string,
): TaskRuleOutcome | undefined {
  const outcomes: readonly TaskRuleOutcome[] = TASK_RULES[rule].outcomes;
  return outcomes.find((candidate) => candidate.id === outcome);
}

/** The rules the Rules popover and the type filter list, in order. */
export const LISTED_TASK_RULES: readonly TaskRuleId[] = TASK_RULE_IDS.filter(
  (rule) => TASK_RULES[rule].listed,
);

// ── Time ──

const MINUTE = 60_000;
const DAY = 86_400_000;

/** The instant a span after `now` lands on (clinic-local for "tomorrow at"). */
export function taskTimeAfter(span: TaskTimeSpan, now: Date): string {
  if (span.kind === 'minutes')
    return new Date(now.getTime() + span.minutes * MINUTE).toISOString();
  if (span.kind === 'days')
    return new Date(now.getTime() + span.days * DAY).toISOString();
  return clinicInstant(addCivilDays(clinicToday(now), 1), span.at);
}

/** What a due rule anchors on. */
export interface TaskDueAnchors {
  now: Date;
  /** When the person's message was sent (Unreplied messages). */
  messageAt?: string;
  /** The lead's follow-up date, clinic-local `YYYY-MM-DD`. */
  followUpDate?: string;
  /** The visit's clinic-local date and start. */
  visit?: { date: string; startTime: string };
  /** The treatment's clinic-local day and how many days after it the call is. */
  treatment?: { date: string; callAfterDays: number };
}

/** Minutes from the visit's start — or, for a visit far enough off, the day before at a set time. */
function visitStartDue(
  due: Extract<TaskDueRule, { from: 'visitStart' }>,
  visit: { date: string; startTime: string },
  now: Date,
): string {
  const start = Date.parse(clinicInstant(visit.date, visit.startTime));
  const far =
    due.beyondHours !== undefined &&
    start - now.getTime() >= due.beyondHours * 60 * MINUTE;
  if (far && due.dayBeforeAt !== undefined) {
    return clinicInstant(addCivilDays(visit.date, -1), due.dayBeforeAt);
  }
  return new Date(start + due.minutes * MINUTE).toISOString();
}

/** When a rule's task is due, or null for a picked due or a missing anchor. */
export function taskDueAt(due: TaskDueRule, anchors: TaskDueAnchors): string | null {
  const { now } = anchors;
  switch (due.from) {
    case 'message':
      return anchors.messageAt
        ? new Date(Date.parse(anchors.messageAt) + due.minutes * MINUTE).toISOString()
        : null;
    case 'followUpDate':
      return anchors.followUpDate ? clinicInstant(anchors.followUpDate, due.at) : null;
    case 'now':
      return new Date(now.getTime() + due.minutes * MINUTE).toISOString();
    case 'visitStart':
      return anchors.visit ? visitStartDue(due, anchors.visit, now) : null;
    case 'visitDay':
      return anchors.visit
        ? clinicInstant(addCivilDays(anchors.visit.date, due.days), due.at)
        : null;
    case 'treatmentDay':
      return anchors.treatment
        ? clinicInstant(
            addCivilDays(anchors.treatment.date, anchors.treatment.callAfterDays),
            due.at,
          )
        : null;
    case 'today':
      return clinicInstant(clinicToday(now), due.at);
    case 'picked':
      return null;
  }
}

/** The task drawer's Snooze options (`tasks.md:178`). */
export const TASK_SNOOZE_OPTIONS = [
  'oneHour',
  'threeHours',
  'tomorrow',
  'nextWeek',
] as const;
/** Zod enum of the Snooze options. */
export const taskSnoozeOptionSchema = z.enum(TASK_SNOOZE_OPTIONS);
/** One Snooze option. */
export type TaskSnoozeOption = z.infer<typeof taskSnoozeOptionSchema>;

/** How long each Snooze option snoozes: "Tomorrow 10:00" is 10:00 tomorrow, clinic-local. */
export const TASK_SNOOZE_SPANS: Readonly<Record<TaskSnoozeOption, TaskTimeSpan>> = {
  oneHour: { kind: 'minutes', minutes: 60 },
  threeHours: { kind: 'minutes', minutes: 180 },
  tomorrow: { kind: 'tomorrowAt', at: '10:00' },
  nextWeek: { kind: 'days', days: 7 },
};

/** "What’s next" When chips (`tasks.md:91`). */
export const TASK_FOLLOW_UP_WHEN = [
  'inThreeHours',
  'tomorrow',
  'inThreeDays',
  'nextWeek',
] as const;
/** Zod enum of the When chips. */
export const taskFollowUpWhenSchema = z.enum(TASK_FOLLOW_UP_WHEN);
/** One When chip. */
export type TaskFollowUpWhen = z.infer<typeof taskFollowUpWhenSchema>;

/** When the follow-up a When chip sets is due: in 3 h, tomorrow 11:00, in 3 or 7 days (`tasks.md:98`). */
export const TASK_FOLLOW_UP_SPANS: Readonly<Record<TaskFollowUpWhen, TaskTimeSpan>> = {
  inThreeHours: { kind: 'minutes', minutes: 180 },
  tomorrow: { kind: 'tomorrowAt', at: '11:00' },
  inThreeDays: { kind: 'days', days: 3 },
  nextWeek: { kind: 'days', days: 7 },
};

/** How long the server keeps the list and the drawer fresh (S:1722; Today and Tasks, §3.6). */
export const TASKS_REFETCH_MS = 60_000;

// ── The list query ──

/** The list's views, "To do · Snoozed · Done" — `open` is the contract's "Queue" (S:1519). */
export const TASK_TABS = ['queue', 'snoozed', 'done'] as const;
/** Zod enum of the views. */
export const taskTabSchema = z.enum(TASK_TABS);
/** One view. */
export type TaskTab = z.infer<typeof taskTabSchema>;

/** "Mine" = mine and unowned; "Everyone" = every owner, offered to every role (Appendix F). */
export const TASK_SCOPES = ['mine', 'everyone'] as const;
/** Zod enum of the scopes. */
export const taskScopeSchema = z.enum(TASK_SCOPES);
/** One scope. */
export type TaskScope = z.infer<typeof taskScopeSchema>;

/** The search field's limit (`tasks.md:66`). */
export const TASK_SEARCH_MAX = 80;

/** A list read: the view, the scope, the rule filter and the search (S:1722 + Appendix F). */
export const taskListQuerySchema = z.object({
  tab: taskTabSchema.default('queue'),
  scope: taskScopeSchema.default('mine'),
  type: z.array(taskRuleIdSchema).default([]),
  q: z.string().trim().max(TASK_SEARCH_MAX).default(''),
});
/** A parsed list query. */
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
/** A list query as callers write it (every field optional). */
export type TaskListQueryInput = z.input<typeof taskListQuerySchema>;

// ── Records ──

/** Who resolved a task: a member, or Clinozy (a rule closing itself, an automation). */
export const TASK_RESOLVERS = ['member', 'clinozy'] as const;
/** Zod enum of the resolvers. */
export const taskResolverSchema = z.enum(TASK_RESOLVERS);

/** The outcome note's limit (`tasks.md:78`). */
export const TASK_NOTE_MAX = 200;

/**
 * A task as the fixture server stores it: the contract's `Task` plus the
 * plan-only fields (Appendix F, REPLACE_WITH_API) — its rule, the rule match it
 * was derived for (server-internal), the rule outcome that closed or snoozed
 * it, the result text, the note, who resolved it, the snooze label and the
 * owners it was moved from.
 */
export const taskRecordSchema = taskSchema.extend({
  rule: taskRuleIdSchema,
  ruleKey: z.string().nullable(),
  ruleOutcome: z.string().nullable(),
  result: z.string().nullable(),
  note: z.string().max(TASK_NOTE_MAX).nullable(),
  resolvedBy: taskResolverSchema.nullable(),
  resolvedById: z.uuid().nullable(),
  snoozeLabel: z.string().nullable(),
  previousOwnerIds: z.array(z.uuid()),
});
/** A stored task. */
export type TaskRecord = z.infer<typeof taskRecordSchema>;

/** The person a task is about: a patient, a lead, or a chat-only contact. */
export const taskPersonSchema = z.object({
  name: z.string(),
  firstName: z.string(),
  patientId: z.uuid().nullable(),
  leadId: z.uuid().nullable(),
  /** A registered patient (sage avatar with the "P" badge; lav otherwise). */
  isPatient: z.boolean(),
});
/** A task's person. */
export type TaskPerson = z.infer<typeof taskPersonSchema>;

/** What a source chip names: "Lead #", "Appt #", "Treatment #", "Patient #", "Payments", "Contact". */
export const TASK_SOURCE_KINDS = [
  'lead',
  'appointment',
  'treatment',
  'patient',
  'invoice',
  'contact',
] as const;

/** A task's source chip — the record kind, its id and its `seq` (null where the contract has none). */
export const taskSourceRefSchema = z.object({
  kind: z.enum(TASK_SOURCE_KINDS),
  id: z.uuid().nullable(),
  seq: z.number().int().nonnegative().nullable(),
});
/** A source chip. */
export type TaskSourceRef = z.infer<typeof taskSourceRefSchema>;

/** A staff member as a task row shows them (owner pills, "was …"). */
export const taskStaffSchema = userSchema.pick({
  id: true,
  firstName: true,
  lastName: true,
  initials: true,
  tone: true,
  active: true,
});
/** A row's staff member. */
export type TaskStaff = z.infer<typeof taskStaffSchema>;

/**
 * A list row: the record with the person, the source chip and the owners
 * embedded, so a row renders without joins (REPLACE_WITH_API: embed them in
 * `listTasks`).
 */
export const taskRowSchema = taskRecordSchema.extend({
  person: taskPersonSchema,
  source: taskSourceRefSchema,
  owner: taskStaffSchema.nullable(),
  previousOwners: z.array(taskStaffSchema),
  /** Owned by the signed-in member. */
  ownedByViewer: z.boolean(),
  /**
   * False for a Done entry with no task behind it — a visit a WhatsApp "Yes"
   * confirmed (H:4270): its row toasts the result instead of opening.
   */
  exists: z.boolean(),
});
/** A list row. */
export type TaskRow = z.infer<typeof taskRowSchema>;

/** The record a task points at (S:1723 "Task + source record"). */
export const taskSourceRecordSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('appointment'), appointment: appointmentSchema }),
  z.object({ kind: z.literal('lead'), lead: leadSchema }),
  z.object({ kind: z.literal('treatment'), treatment: treatmentSchema }),
  z.object({ kind: z.literal('patient'), patient: patientSchema }),
  z.object({ kind: z.literal('invoice'), invoice: invoiceSchema }),
]);
/** A task's source record. */
export type TaskSourceRecord = z.infer<typeof taskSourceRecordSchema>;

/**
 * The drawer's read (`getTask`, S:1723): the row, its source record, the
 * person's patient record, the person's thread — their lead, else their
 * existing contact thread; null until `ensureContactThread` makes one — with
 * its messages, the message to quote (the inbound one for Unreplied messages,
 * the undelivered one for Messages not delivered), the suggested WhatsApp, and
 * the staff the context tiles name.
 */
export const taskDetailSchema = z.object({
  task: taskRowSchema,
  source: taskSourceRecordSchema.nullable(),
  patient: patientSchema.nullable(),
  thread: leadSchema.nullable(),
  activity: z.array(leadMessageSchema),
  quote: z.string().nullable(),
  suggestion: z.string().nullable(),
  staff: z.array(taskStaffSchema),
});
/** The drawer's read. */
export type TaskDetail = z.infer<typeof taskDetailSchema>;

// ── Writes ──

/** Close, snooze or act on a task with one of its rule's outcomes (`resolveTask`, S:1728). */
export const recordTaskOutcomeInputSchema = z.object({
  taskId: z.uuid(),
  outcome: z.string().min(1),
  note: z.string().trim().max(TASK_NOTE_MAX).optional(),
});
/** An outcome write. */
export type RecordTaskOutcomeInput = z.infer<typeof recordTaskOutcomeInputSchema>;

/** Snooze a task with one of the drawer's options. */
export const snoozeTaskInputSchema = z.object({
  taskId: z.uuid(),
  option: taskSnoozeOptionSchema,
});
/** A snooze write. */
export type SnoozeTaskInput = z.infer<typeof snoozeTaskInputSchema>;

/** Move a task to someone else; the previous owner stays involved. */
export const reassignTaskInputSchema = z.object({
  taskId: z.uuid(),
  ownerId: z.uuid(),
});
/** A reassign write. */
export type ReassignTaskInput = z.infer<typeof reassignTaskInputSchema>;

/**
 * Create a task (`createTask`, S:1727): the contract's fields, plus the rule
 * (default "Follow-ups you set") and the task it follows — its source is
 * copied, the way "What’s next" chains (`tasks.md:56`).
 */
export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  why: z.string().trim().max(280).nullable().default(null),
  ownerId: z.uuid().nullable(),
  ownerRole: taskSchema.shape.ownerRole.default(null),
  patientId: z.uuid().nullable().default(null),
  leadId: z.uuid().nullable().default(null),
  dueAt: taskSchema.shape.dueAt,
  rule: taskRuleIdSchema.default('manual'),
  kind: taskKindSchema.optional(),
  followsTaskId: z.uuid().nullable().default(null),
});
/** A create as callers write it. */
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

/** One rule's org setting: on (its tasks show) and handed to Clinozy. */
export const taskRuleSettingSchema = z.object({
  on: z.boolean(),
  handled: z.boolean(),
});
/** One rule's setting. */
export type TaskRuleSetting = z.infer<typeof taskRuleSettingSchema>;

/** Every rule's setting (the Rules popover; org settings, Appendix F). */
export const taskRuleSettingsSchema = z.record(taskRuleIdSchema, taskRuleSettingSchema);
/** Every rule's setting. */
export type TaskRuleSettings = z.infer<typeof taskRuleSettingsSchema>;

/** A change to one rule's setting. */
export const saveTaskRuleSettingInputSchema = taskRuleSettingSchema.partial().extend({
  rule: taskRuleIdSchema,
});
/** A rule-setting write. */
export type SaveTaskRuleSettingInput = z.infer<typeof saveTaskRuleSettingInputSchema>;

/** A write's answer: the task after it, and the token that undoes it (every toast offers Undo). */
export const taskChangeSchema = z.object({
  task: taskRowSchema,
  undoToken: z.string(),
});
/** A write's answer. */
export type TaskChange = z.infer<typeof taskChangeSchema>;
