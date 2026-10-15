/**
 * Needs you now (change-today-command-center, BRIEF.md change 1): the people on the floor who
 * need someone now, ranked — and the lane tiles' alert badges (change 2). Derived from the floor
 * Today already reads (the lanes, the clock, today's bills); nothing is stored. Pure, so each
 * rule is tested apart from React.
 */
import type { TodayLane } from '@/shared/api/app/today-contracts.ts';

import {
  LATE_AFTER_MINUTES,
  minutesSince,
  minutesToStart,
  NO_DUES,
  stageMinutes,
  type TodayDues,
  type TodayWaitLevel,
  todayWaitLevel,
  WAIT_LEVEL_MINUTES,
  waitMinutes,
} from './today.flags.ts';
import { isLaneInFocus, type TodayCard, type TodayLanes } from './today.lanes.ts';

/** How urgent an item is: hot first, then warm, then soon. */
export type TodayAttentionTier = 'hot' | 'warm' | 'soon';

/**
 * Why a person needs someone: late for their booking, due in the next minutes, a long wait, a
 * long consult, at checkout, an Rx ready to dispense, an enquiry with no reply.
 */
export type TodayAttentionKind =
  'late' | 'due' | 'waiting' | 'inRoom' | 'checkout' | 'rx' | 'reply';

/** One person who needs someone now. */
export interface TodayAttentionItem {
  card: TodayCard;
  kind: TodayAttentionKind;
  tier: TodayAttentionTier;
  /**
   * The item's clock in minutes: how late, how long waiting / in the room / at checkout / since
   * the Rx was approved / since the enquiry's last message — or, for `due`, how long until the
   * start (0 when it is now). Ranks the items within a tier.
   */
  minutes: number;
  /** What the person still owes on today's bills — a checkout item, when known and above zero. */
  rupees: number | null;
}

/**
 * The marks, in minutes: late from 5 (hot from 15); due within the next 10; an enquiry
 * unanswered from 30 (hot from 120). The waits' marks are the cards' (`WAIT_LEVEL_MINUTES`).
 */
export const ATTENTION_MINUTES = {
  lateHot: 15,
  dueSoon: 10,
  reply: { warm: 30, hot: 120 },
} as const;

/** A wait level as a tier: calm is no item at all. */
function tierOfLevel(level: TodayWaitLevel): TodayAttentionTier | null {
  if (level === 'hot') return 'hot';
  if (level === 'warm') return 'warm';
  return null;
}

/** An arriving booking: late, due, or not yet worth a look. */
function arrivingItem(card: TodayCard, now: Date): TodayAttentionItem | null {
  const toStart = minutesToStart(card.time, now);
  if (toStart <= -LATE_AFTER_MINUTES) {
    const late = -toStart;
    return {
      card,
      kind: 'late',
      tier: late >= ATTENTION_MINUTES.lateHot ? 'hot' : 'warm',
      minutes: late,
      rupees: null,
    };
  }
  if (toStart <= ATTENTION_MINUTES.dueSoon) {
    return {
      card,
      kind: 'due',
      tier: 'soon',
      minutes: Math.max(0, toStart),
      rupees: null,
    };
  }
  return null;
}

/** An enquiry with no reply for a while. */
function replyItem(
  card: Extract<TodayCard, { kind: 'enquiry' }>,
  now: Date,
): TodayAttentionItem | null {
  const minutes = minutesSince(card.enquiry.lastActivityAt, now);
  if (minutes < ATTENTION_MINUTES.reply.warm) return null;
  const tier = minutes >= ATTENTION_MINUTES.reply.hot ? 'hot' : 'warm';
  return { card, kind: 'reply', tier, minutes, rupees: null };
}

/** A checked-in booking's item by its lane — none in Treatment, none for a short wait. */
function visitItem(
  card: Extract<TodayCard, { kind: 'booking' }>,
  now: Date,
  dues: TodayDues,
): TodayAttentionItem | null {
  switch (card.lane) {
    case 'waiting':
    case 'with_doctor': {
      const kind = card.lane === 'waiting' ? 'waiting' : 'inRoom';
      const minutes = waitMinutes(card, kind, now);
      const tier = tierOfLevel(todayWaitLevel(kind, minutes));
      return tier ? { card, kind, tier, minutes, rupees: null } : null;
    }
    case 'checkout': {
      const owed = dues.get(card.row.contactId) ?? 0;
      return {
        card,
        kind: 'checkout',
        tier: 'warm',
        minutes: stageMinutes(card, now),
        rupees: owed > 0 ? owed : null,
      };
    }
    case 'pharmacy':
      return card.row.prescription
        ? {
            card,
            kind: 'rx',
            tier: 'warm',
            minutes: minutesSince(card.row.prescription.approvedAt, now),
            rupees: null,
          }
        : null;
    default:
      return null;
  }
}

/** A card's item, or null when it needs no one now. */
export function todayAttentionItem(
  card: TodayCard,
  now: Date,
  dues: TodayDues = NO_DUES,
): TodayAttentionItem | null {
  if (card.kind === 'enquiry') return replyItem(card, now);
  if (card.lane === 'arriving') return arrivingItem(card, now);
  return visitItem(card, now, dues);
}

const TIER_ORDER: Readonly<Record<TodayAttentionTier, number>> = {
  hot: 0,
  warm: 1,
  soon: 2,
};

/**
 * Each clock's hot mark, in minutes — what an item's minutes are measured against when items
 * of different kinds are ranked: late 15, waiting 30, in room 45, no reply 120; checkout and an
 * Rx 15 (someone standing at the desk).
 */
const HOT_MARK_MINUTES: Readonly<Record<Exclude<TodayAttentionKind, 'due'>, number>> = {
  late: ATTENTION_MINUTES.lateHot,
  waiting: WAIT_LEVEL_MINUTES.waiting.hot,
  inRoom: WAIT_LEVEL_MINUTES.inRoom.hot,
  reply: ATTENTION_MINUTES.reply.hot,
  checkout: 15,
  rx: 15,
};

/**
 * How far an item is along its own clock — its minutes over its kind's hot mark — so a patient
 * waiting 53 minutes (1.8 marks) comes before a WhatsApp unanswered for 2½ hours (1.3).
 */
function urgencyOf(item: TodayAttentionItem): number {
  return item.kind === 'due' ? -item.minutes : item.minutes / HOT_MARK_MINUTES[item.kind];
}

/**
 * Hot, then warm, then soon; within a tier the furthest along its own clock first
 * ({@link urgencyOf}) — within soon the nearest start; then by the card's time and name, so
 * the order never jumps on a tie.
 */
function byUrgency(a: TodayAttentionItem, b: TodayAttentionItem): number {
  const tier = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
  if (tier !== 0) return tier;
  return (
    urgencyOf(b) - urgencyOf(a) ||
    a.card.time.localeCompare(b.card.time) ||
    a.card.name.localeCompare(b.card.name)
  );
}

/**
 * Needs you now: every item in the lanes the member can read (`visible`) and keeps an eye on
 * (`focus` — empty for Owner and Admin, who see every readable lane), most urgent first.
 */
export function todayAttention({
  lanes,
  now,
  dues = NO_DUES,
  focus,
  visible,
}: {
  lanes: TodayLanes;
  now: Date;
  dues?: TodayDues;
  focus: ReadonlySet<TodayLane>;
  visible: readonly TodayLane[];
}): TodayAttentionItem[] {
  return visible
    .filter((lane) => isLaneInFocus(lane, focus))
    .flatMap((lane) => lanes[lane])
    .flatMap((card) => {
      const item = todayAttentionItem(card, now, dues);
      return item ? [item] : [];
    })
    .sort(byUrgency);
}

/** The items a tile's badge counts: the clocks running over — not checkout or an Rx, which every card there is. */
const ALERT_KINDS: ReadonlySet<TodayAttentionKind> = new Set([
  'late',
  'waiting',
  'inRoom',
  'reply',
]);

/** A tile's alert: how many of its people are over a mark, and whether any is hot. */
export interface TodayLaneAlert {
  /** Which clock the lane's badge counts (one per lane). */
  kind: Extract<TodayAttentionKind, 'late' | 'waiting' | 'inRoom' | 'reply'>;
  count: number;
  hot: boolean;
}

/**
 * The tiles' alert badges: per lane, the people running late (Arriving), waiting long
 * (Waiting), in the room long (With doctor) or unanswered (Enquiries). Every lane the member
 * reads — the badges are the floor's, not the member's focus.
 */
export function todayLaneAlerts(
  lanes: TodayLanes,
  now: Date,
): Partial<Record<TodayLane, TodayLaneAlert>> {
  const alerts: Partial<Record<TodayLane, TodayLaneAlert>> = {};
  for (const lane of ['enquiries', 'arriving', 'waiting', 'with_doctor'] as const) {
    const items = lanes[lane].flatMap((card) => {
      const item = todayAttentionItem(card, now);
      return item && item.tier !== 'soon' && ALERT_KINDS.has(item.kind) ? [item] : [];
    });
    const [first] = items;
    if (!first) continue;
    alerts[lane] = {
      kind: first.kind as TodayLaneAlert['kind'],
      count: items.length,
      hot: items.some((item) => item.tier === 'hot'),
    };
  }
  return alerts;
}
