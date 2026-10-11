import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { TodayLane } from '@/shared/api/app/today-contracts.ts';
import type { GreetingPart } from '@/shared/app/app-greeting.ts';

/** The Today room's i18n namespace. */
export const TODAY_NS = I18N_NAMESPACES.today;

/**
 * A lane card's action (`today.md:226`) — With doctor has none since the
 * consult moved to the patient's page (L-64).
 */
export type TodayCardAction =
  'book' | 'checkIn' | 'sendIn' | 'openSession' | 'checkout' | 'dispense';

/**
 * The Today room's keys, verbatim from `today.md` › Copy (KICKOFF §6.2). The
 * work queue's rule labels, outcomes, due labels, scope words and empty line
 * are the Tasks room's (one task model, Q-T3) — `TASK_RULE_KEYS`,
 * `TASK_DUE_KEYS` and `TASK_QUEUE_KEYS` in the `tasks` namespace, which loads
 * with Today.
 */
export const TODAY_KEYS = {
  manifest: { title: 'manifest.title' },
  /** "Good morning, <first name>" — the clinic clock's part of the day (`greetingFor`). */
  greeting: {
    morning: 'greeting.morning',
    afternoon: 'greeting.afternoon',
    evening: 'greeting.evening',
    /** The name when the member has no first name (`today.md:219`). */
    nobody: 'greeting.nobody',
  } satisfies Record<GreetingPart | 'nobody', string>,
  /** "<n> in clinic · <n> waiting · <n> arriving · <Ddd D Mon>, <HH:MM>". */
  pulse: 'pulse',
  newBooking: 'newBooking',
  walkIn: 'walkIn',
  /** Where the screen is still loading (read by screen readers while the bars show). */
  loading: 'loading',
  lanes: {
    /** The tiles' group name. */
    label: 'lanes.label',
    names: {
      enquiries: 'lanes.names.enquiries',
      arriving: 'lanes.names.arriving',
      waiting: 'lanes.names.waiting',
      with_doctor: 'lanes.names.withDoctor',
      treatment: 'lanes.names.treatment',
      checkout: 'lanes.names.checkout',
      pharmacy: 'lanes.names.pharmacy',
    } satisfies Record<TodayLane, string>,
    /** The tile hint: "oldest 10:12" · "next 11:00" · "since 10:40" · "—". */
    hints: {
      oldest: 'lanes.hints.oldest',
      next: 'lanes.hints.next',
      since: 'lanes.hints.since',
      none: 'lanes.hints.none',
    },
    /** "+2" after four faces. */
    more: 'lanes.more',
    /** In place of the tiles when the member can read no lane (F3, D163). */
    none: 'lanes.none',
    /** "1 person" · "<n> people" (plural). */
    count: 'lanes.count',
    empty: 'lanes.empty',
  },
  actions: {
    book: 'actions.book',
    checkIn: 'actions.checkIn',
    sendIn: 'actions.sendIn',
    openSession: 'actions.openSession',
    checkout: 'actions.checkout',
    dispense: 'actions.dispense',
  } satisfies Record<TodayCardAction, string>,
  card: {
    /** "Hydrafacial · Room 2" — the service and where (or with whom). */
    service: 'card.service',
    /** "3 medicines prescribed" (plural). */
    medicines: 'card.medicines',
  },
  flags: {
    newLead: 'flags.newLead',
    confirmed: 'flags.confirmed',
    unconfirmed: 'flags.unconfirmed',
    waiting: 'flags.waiting',
    inRoom: 'flags.inRoom',
    /** "₹1,500 to pay" — a Checkout card's open bill today. */
    toPay: 'flags.toPay',
    rxApproved: 'flags.rxApproved',
  },
  toasts: {
    checkedIn: 'toasts.checkedIn',
    sentIn: 'toasts.sentIn',
    noRecord: 'toasts.noRecord',
    /** A work-queue outcome: "<name>: <result>". */
    outcome: 'toasts.outcome',
    /** An outcome that snoozes reads its snooze as the result. */
    snoozed: 'toasts.snoozed',
  },
  queue: {
    title: 'queue.title',
    /** "<n> open · each has an owner and a due time" (every open task, whatever the scope). */
    sub: 'queue.sub',
    /** The Mine · Everyone control's name. */
    scope: 'queue.scope',
    owner: 'queue.owner',
    /** "<first name> (you)". */
    you: 'queue.you',
    /** "✓ <result>" once closed. */
    closed: 'queue.closed',
  },
} as const;

/** Today's test ids (`docs/reference/e2e-testids-inventory.md` › Today). */
export const TODAY_TEST_IDS = {
  page: 'today-page',
  greeting: 'today-greeting',
  pulse: 'today-pulse',
  newBooking: 'today-new-booking',
  walkIn: 'today-walk-in',
  lanes: 'today-lanes',
  /** The note in place of the tiles when the member can read no lane (F3, D163). */
  noLanes: 'today-no-lanes',
  lane: (lane: TodayLane) => `today-lane-${lane.replace('_', '-')}`,
  panel: 'today-panel',
  card: 'today-card',
  cardOpen: 'today-card-open',
  cardAction: 'today-card-action',
  empty: 'today-empty',
  queue: 'today-queue',
  queueScope: (scope: 'mine' | 'everyone') => `today-queue-scope-${scope}`,
  queueCard: 'today-queue-card',
  queueOutcome: 'today-queue-outcome',
  queueEmpty: 'today-queue-empty',
} as const;
