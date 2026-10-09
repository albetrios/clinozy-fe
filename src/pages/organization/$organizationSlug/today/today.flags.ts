/**
 * A card's flags (KICKOFF §6.2 Visit cards; `today.md:59`): derived from the
 * record, never stored strings — the channel and "New lead" of an enquiry; a
 * booking's lane state (confirmed or not, minutes waiting, minutes in the
 * room, the approved Rx). The design's first visit, pack, dues, allergies,
 * session and "to pay" flags have no field in the API (api-integration §8 G1).
 * Pure; the room words them.
 */
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicClockTime } from '@/shared/api/clinic/clinic-time.ts';

import type { TodayCard } from './today.lanes.ts';

/** One flag, as data. */
export type TodayFlag =
  | { id: 'channel'; channel: 'whatsapp' | 'instagram' }
  | { id: 'newLead' }
  | { id: 'confirmed' }
  | { id: 'unconfirmed' }
  | { id: 'waiting'; minutes: number }
  | { id: 'inRoom'; minutes: number }
  | { id: 'rxApproved'; time: string };

/** A flag's id. */
export type TodayFlagId = TodayFlag['id'];

/**
 * Each flag's tone (`today.md:59`): the channel and "New lead" lav,
 * "Confirmed" sage, "Unconfirmed" blush, "Waiting" butter, "In room" blush,
 * the Rx mint.
 */
export const TODAY_FLAG_TONES: Readonly<Record<TodayFlagId, Tone>> = {
  channel: 'lav',
  newLead: 'lav',
  confirmed: 'sage',
  unconfirmed: 'blush',
  waiting: 'butter',
  inRoom: 'blush',
  rxApproved: 'mint',
};

/** Whole minutes from an instant to now — never below zero. */
function minutesSince(instant: string | null, now: Date): number {
  if (!instant) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(instant)) / 60_000));
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
        row.status === 'confirmed'
          ? { id: 'confirmed' as const }
          : { id: 'unconfirmed' as const },
      ];
    case 'waiting':
      return [
        {
          id: 'waiting' as const,
          minutes: minutesSince(row.visitStageChangedAt ?? row.checkedInAt, now),
        },
      ];
    case 'with_doctor':
      return [
        { id: 'inRoom' as const, minutes: minutesSince(row.visitStageChangedAt, now) },
      ];
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
