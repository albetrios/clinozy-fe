/**
 * A card's flags (KICKOFF §6.2 Visit cards; `today.md:59`): derived from the
 * record, never stored strings — the channel and "New lead" of an enquiry; a
 * booking's lane state (late, due now or in n minutes, confirmed or not,
 * minutes waiting, minutes in the room, what a Checkout card's person still
 * owes on today's bills, the approved Rx). The design's first visit, pack,
 * dues, allergies and session flags have no field in the API (api-integration
 * §8 G1). Pure; the room words them. The clocks here — minutes to a start,
 * minutes since a stage, how long a wait is — are the ones Needs you now ranks
 * by (`today.attention.ts`; change-today-command-center).
 */
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { appClockTime, clockMinutes } from '@/shared/api/app/app-time.ts';

import type { TodayCard } from './today.lanes.ts';

/** One flag, as data. */
export type TodayFlag =
  | { id: 'channel'; channel: 'whatsapp' | 'instagram' }
  | { id: 'newLead' }
  | { id: 'late'; minutes: number }
  | { id: 'dueNow' }
  | { id: 'dueIn'; minutes: number }
  | { id: 'confirmed' }
  | { id: 'unconfirmed' }
  | { id: 'waiting'; minutes: number }
  | { id: 'inRoom'; minutes: number }
  | { id: 'toPay'; rupees: number }
  | { id: 'rxApproved'; time: string };

/** A flag's id. */
export type TodayFlagId = TodayFlag['id'];

/**
 * Each flag's tone (`today.md:59`): the channel and "New lead" lav, "Late"
 * blush, "Due now" butter, "In n min" sky, "Confirmed" sage, "Unconfirmed"
 * blush, "Waiting" butter (blush once the wait is hot, {@link todayFlagTone}),
 * "In room" blush, "to pay" butter, the Rx mint.
 */
export const TODAY_FLAG_TONES: Readonly<Record<TodayFlagId, Tone>> = {
  channel: 'lav',
  newLead: 'lav',
  late: 'blush',
  dueNow: 'butter',
  dueIn: 'sky',
  confirmed: 'sage',
  unconfirmed: 'blush',
  waiting: 'butter',
  inRoom: 'blush',
  toPay: 'butter',
  rxApproved: 'mint',
};

/**
 * What each person on the floor still owes on today's bills, in rupees, by contact id — the
 * server's `due_amount` of their open invoices dated today (Today's checkout read).
 */
export type TodayDues = ReadonlyMap<string, number>;

/** No dues read (the member may not read money, or no one is at checkout). */
export const NO_DUES: TodayDues = new Map();

/** Whole minutes from an instant to now — never below zero. */
export function minutesSince(instant: string | null, now: Date): number {
  if (!instant) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(instant)) / 60_000));
}

/**
 * Minutes from now to a clinic-local `HH:mm` start on today's floor — negative once it has
 * passed (the clinic's clock, so the viewer's own time zone never shifts it).
 */
export function minutesToStart(time: string, now: Date): number {
  return clockMinutes(time) - clockMinutes(appClockTime(now));
}

/** Minutes past its start from which an arriving booking reads "Late". */
export const LATE_AFTER_MINUTES = 5;

/** Within this many minutes of its start an arriving card says "In n min". */
const ARRIVING_SOON_MINUTES = 60;

/** How long a wait is: under the warm mark, past it, or past the hot mark. */
export type TodayWaitLevel = 'calm' | 'warm' | 'hot';

/** The clocks a wait is measured on: in Waiting, and With doctor ("in room"). */
export type TodayWaitKind = 'waiting' | 'inRoom';

/**
 * Where a wait turns warm and hot, in minutes: Waiting 15 and 30, In room 30 and 45 (a consult
 * runs longer than a wait should).
 */
export const WAIT_LEVEL_MINUTES: Readonly<
  Record<TodayWaitKind, { warm: number; hot: number }>
> = {
  waiting: { warm: 15, hot: 30 },
  inRoom: { warm: 30, hot: 45 },
};

/** A wait's level on its clock. */
export function todayWaitLevel(kind: TodayWaitKind, minutes: number): TodayWaitLevel {
  const marks = WAIT_LEVEL_MINUTES[kind];
  if (minutes >= marks.hot) return 'hot';
  if (minutes >= marks.warm) return 'warm';
  return 'calm';
}

/** Each wait level's tone — the meter's fill: sage, butter, blush. */
export const WAIT_LEVEL_TONES: Readonly<Record<TodayWaitLevel, Tone>> = {
  calm: 'sage',
  warm: 'butter',
  hot: 'blush',
};

/**
 * A card's wait meter: how full (0–1, full at the hot mark) and its level. A Waiting card's
 * wait, a With-doctor card's time in the room; none on any other card.
 */
export function todayWaitMeter(
  card: TodayCard,
  now: Date,
): { kind: TodayWaitKind; minutes: number; level: TodayWaitLevel; fill: number } | null {
  if (card.kind !== 'booking') return null;
  const kind = waitKindOf(card.lane);
  if (!kind) return null;
  const minutes = waitMinutes(card, kind, now);
  return {
    kind,
    minutes,
    level: todayWaitLevel(kind, minutes),
    fill: Math.min(1, minutes / WAIT_LEVEL_MINUTES[kind].hot),
  };
}

/** The wait clock a lane runs, if any. */
function waitKindOf(lane: TodayCard['lane']): TodayWaitKind | null {
  if (lane === 'waiting') return 'waiting';
  if (lane === 'with_doctor') return 'inRoom';
  return null;
}

/**
 * Minutes a checked-in booking has spent in its current stage — from the stage's stamp, else
 * from the check-in (a visit still waiting has no stage change yet).
 */
export function stageMinutes(
  card: Extract<TodayCard, { kind: 'booking' }>,
  now: Date,
): number {
  return minutesSince(card.row.visitStageChangedAt ?? card.row.checkedInAt, now);
}

/**
 * The minutes on a wait clock: a Waiting card's {@link stageMinutes}; a With-doctor card's
 * since it went in (its stage's stamp alone — the check-in is not the consult).
 */
export function waitMinutes(
  card: Extract<TodayCard, { kind: 'booking' }>,
  kind: TodayWaitKind,
  now: Date,
): number {
  return kind === 'waiting'
    ? stageMinutes(card, now)
    : minutesSince(card.row.visitStageChangedAt, now);
}

/** A flag's tone: its own ({@link TODAY_FLAG_TONES}), a hot wait's blush. */
export function todayFlagTone(flag: TodayFlag): Tone {
  if (flag.id === 'waiting' && todayWaitLevel('waiting', flag.minutes) === 'hot') {
    return 'blush';
  }
  return TODAY_FLAG_TONES[flag.id];
}

/**
 * An arriving booking's timing (BRIEF.md change 4): "Late n min" from {@link LATE_AFTER_MINUTES}
 * past its start, "Due now" in the minutes around it, "In n min" within the hour, else nothing.
 */
function arrivingTiming(time: string, now: Date): TodayFlag[] {
  const minutes = minutesToStart(time, now);
  if (minutes <= -LATE_AFTER_MINUTES) return [{ id: 'late', minutes: -minutes }];
  if (minutes <= 0) return [{ id: 'dueNow' }];
  if (minutes <= ARRIVING_SOON_MINUTES) return [{ id: 'dueIn', minutes }];
  return [];
}

/** A Checkout card's "₹n to pay": what the person owes on today's bills, when anything. */
function checkoutFlags(contactId: string, dues: TodayDues): TodayFlag[] {
  const rupees = dues.get(contactId) ?? 0;
  return rupees > 0 ? [{ id: 'toPay', rupees }] : [];
}

/** A booking's flags in its lane. */
function bookingFlags(
  card: Extract<TodayCard, { kind: 'booking' }>,
  now: Date,
  dues: TodayDues,
): TodayFlag[] {
  const { row } = card;
  switch (card.lane) {
    case 'arriving':
      return [
        ...arrivingTiming(card.time, now),
        row.status === 'confirmed'
          ? { id: 'confirmed' as const }
          : { id: 'unconfirmed' as const },
      ];
    case 'waiting':
      return [{ id: 'waiting' as const, minutes: waitMinutes(card, 'waiting', now) }];
    case 'with_doctor':
      return [{ id: 'inRoom' as const, minutes: waitMinutes(card, 'inRoom', now) }];
    case 'checkout':
      return checkoutFlags(row.contactId, dues);
    case 'pharmacy':
      return row.prescription
        ? [
            {
              id: 'rxApproved' as const,
              time: appClockTime(new Date(row.prescription.approvedAt)),
            },
          ]
        : [];
    default:
      return [];
  }
}

/** The channels an enquiry's flag names — the ones the design paints (`today.md:59`). */
const CHANNEL_SOURCES = new Set(['whatsapp', 'instagram']);

/**
 * A card's flags at `now`, in the order the card shows them; `dues` — today's open bills by
 * person — words a Checkout card's "₹n to pay".
 */
export function todayCardFlags(
  card: TodayCard,
  now: Date,
  dues: TodayDues = NO_DUES,
): TodayFlag[] {
  if (card.kind === 'enquiry') {
    const { source, status } = card.enquiry;
    const flags: TodayFlag[] = [];
    if (source && CHANNEL_SOURCES.has(source)) {
      flags.push({ id: 'channel', channel: source as 'whatsapp' | 'instagram' });
    }
    if (status === 'new') flags.push({ id: 'newLead' });
    return flags;
  }
  return bookingFlags(card, now, dues);
}
