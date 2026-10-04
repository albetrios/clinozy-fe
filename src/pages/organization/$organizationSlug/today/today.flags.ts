/**
 * A card's flags (KICKOFF §6.2 Visit cards; `today.md:59`): derived from the
 * record, never stored strings — the channel and "New lead" of an enquiry; a
 * booking's first visit, pack, dues and allergies, then its lane's own state
 * (confirmed or not, minutes waiting, minutes in the room, the session, the
 * bill, the approved Rx). Pure; the room words them.
 */
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicClockTime } from '@/shared/api/clinic/clinic-time.ts';
import type { TodayFloorRow } from '@/shared/api/clinic/today-contracts.ts';

import type { TodayCard } from './today.lanes.ts';

/** One flag, as data. */
export type TodayFlag =
  | { id: 'channel'; channel: 'whatsapp' | 'instagram' }
  | { id: 'newLead' }
  | { id: 'confirmed' }
  | { id: 'unconfirmed' }
  | { id: 'firstVisit' }
  | { id: 'packLeft'; left: number }
  | { id: 'due'; paise: number }
  | { id: 'allergy'; name: string }
  | { id: 'waiting'; minutes: number }
  | { id: 'inRoom'; minutes: number }
  | { id: 'session'; number: number; total: number }
  | { id: 'toPay'; paise: number }
  | { id: 'rxApproved'; time: string };

/** A flag's id. */
export type TodayFlagId = TodayFlag['id'];

/**
 * Each flag's tone (`today.md:59`): the channel and "New lead" lav,
 * "Confirmed" sage, "Unconfirmed" blush, "First visit" sky, the pack sage, a
 * due butter, an allergy blush, "Waiting" butter, "In room" blush, the session
 * sage, "to pay" butter, the Rx mint.
 */
export const TODAY_FLAG_TONES: Readonly<Record<TodayFlagId, Tone>> = {
  channel: 'lav',
  newLead: 'lav',
  confirmed: 'sage',
  unconfirmed: 'blush',
  firstVisit: 'sky',
  packLeft: 'sage',
  due: 'butter',
  allergy: 'blush',
  waiting: 'butter',
  inRoom: 'blush',
  session: 'sage',
  toPay: 'butter',
  rxApproved: 'mint',
};

/** Whole minutes from an instant to now — never below zero. */
function minutesSince(instant: string | null, now: Date): number {
  if (!instant) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(instant)) / 60_000));
}

/** Who the person is beyond this visit: a first visit, their pack, what they owe, their allergies. */
function personFlags(row: TodayFloorRow): TodayFlag[] {
  const flags: TodayFlag[] = [];
  if (row.firstVisit) flags.push({ id: 'firstVisit' });
  if (row.pack) flags.push({ id: 'packLeft', left: row.pack.total - row.pack.used });
  if (row.dueTotal > 0) flags.push({ id: 'due', paise: row.dueTotal });
  for (const name of row.allergies) flags.push({ id: 'allergy', name });
  return flags;
}

/** A booking's flags in its lane. */
function bookingFlags(
  card: Extract<TodayCard, { kind: 'booking' }>,
  now: Date,
): TodayFlag[] {
  const { row } = card;
  switch (card.lane) {
    case 'arriving':
      return [
        ...personFlags(row),
        row.status === 'confirmed'
          ? { id: 'confirmed' as const }
          : { id: 'unconfirmed' as const },
      ];
    case 'waiting': {
      const since = row.visit?.stage === 'waiting' ? row.visit.stageAt : row.checkedInAt;
      return [
        ...personFlags(row),
        { id: 'waiting' as const, minutes: minutesSince(since, now) },
      ];
    }
    case 'with_doctor':
      return [
        ...row.allergies.map((name) => ({ id: 'allergy' as const, name })),
        { id: 'inRoom' as const, minutes: minutesSince(row.visit?.stageAt ?? null, now) },
      ];
    case 'treatment':
      return row.pack
        ? [{ id: 'session' as const, number: row.pack.used + 1, total: row.pack.total }]
        : [];
    case 'checkout':
      return row.toPay > 0 ? [{ id: 'toPay' as const, paise: row.toPay }] : [];
    case 'pharmacy':
      return row.prescription
        ? [
            {
              id: 'rxApproved' as const,
              time: clinicClockTime(new Date(row.prescription.approvedAt)),
            },
          ]
        : [];
    default:
      return [];
  }
}

/** The channels an enquiry's flag names — the ones the design paints (`today.md:59`). */
const CHANNEL_SOURCES = new Set(['whatsapp', 'instagram']);

/** A card's flags at `now`, in the order the card shows them. */
export function todayCardFlags(card: TodayCard, now: Date): TodayFlag[] {
  if (card.kind === 'enquiry') {
    const { source, status } = card.enquiry;
    const flags: TodayFlag[] = [];
    if (source && CHANNEL_SOURCES.has(source)) {
      flags.push({ id: 'channel', channel: source as 'whatsapp' | 'instagram' });
    }
    if (status === 'new') flags.push({ id: 'newLead' });
    return flags;
  }
  return bookingFlags(card, now);
}
