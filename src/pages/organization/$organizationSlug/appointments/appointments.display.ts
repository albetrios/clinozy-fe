/**
 * How the Appointments room paints and words a booking (KICKOFF §6.4): the
 * person's avatar tone, the Agenda's day-group words and tone, and the
 * "Latest update" pill. Pure — every view (Agenda, the card, the calendar
 * blocks) reads these, and the tests pin them. The service tone and the
 * contact card are shared with the appointment form
 * (`@/shared/app/appointment-display.ts`).
 */
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { civilDayOffset } from '@/shared/api/app/app-time.ts';
import type {
  AppointmentPersonKind,
  AppointmentRow,
} from '@/shared/api/app/appointments-contracts.ts';

// ── Tones ──

/** The Agenda's avatar tone: patients sage, leads lav, anyone else grey (H:5972). */
export const PERSON_TONES: Readonly<Record<AppointmentPersonKind, Tone>> = {
  patient: 'sage',
  lead: 'lav',
  contact: 'stone',
};

/** A calendar block's avatar tone: patients sage, everyone else lav (`avTone`, H:5892). */
export function blockPersonTone(kind: AppointmentPersonKind): Tone {
  return kind === 'patient' ? 'sage' : 'lav';
}

// ── The Agenda's day groups ──

/** The tones day tiles cycle through after today's sage (H:5906). */
const DAY_TONES = [
  'sky',
  'lav',
  'blush',
  'butter',
  'mint',
] as const satisfies readonly Tone[];

/** The tones a day group can take: today's sage and the five of the cycle. */
export type DayGroupTone = 'sage' | (typeof DAY_TONES)[number];

/** A day group's tone: sage for today, else the cycle by the group's place. */
export function dayGroupTone(
  date: string,
  today: string,
  groupIndex: number,
): DayGroupTone {
  if (date === today) return 'sage';
  return DAY_TONES[groupIndex % DAY_TONES.length] ?? 'sky';
}

/**
 * A day group's label: "Today", "Tomorrow", else the weekday the caller
 * formats (H:5906).
 */
export type DayGroupLabel = 'today' | 'tomorrow' | 'weekday';

/**
 * A day group's sub line (H:5906): the weekday (today, tomorrow) · "In <n>
 * days" (2–6) · "Next week" (7–13) · "In <n> weeks" · and for a past day
 * "Yesterday" · "<n> days ago".
 */
export type DayGroupSub =
  | { kind: 'weekday' }
  | { kind: 'inDays'; days: number }
  | { kind: 'nextWeek' }
  | { kind: 'inWeeks'; weeks: number }
  | { kind: 'yesterday' }
  | { kind: 'daysAgo'; days: number };

/** How a day group names its day, relative to today (`agendaGroupLabel`). */
export function agendaGroupLabel(
  date: string,
  today: string,
): { label: DayGroupLabel; sub: DayGroupSub } {
  const days = civilDayOffset(today, date);
  let label: DayGroupLabel = 'weekday';
  if (days === 0) label = 'today';
  else if (days === 1) label = 'tomorrow';
  if (days < 0) {
    return {
      label,
      sub: days === -1 ? { kind: 'yesterday' } : { kind: 'daysAgo', days: -days },
    };
  }
  if (days <= 1) return { label, sub: { kind: 'weekday' } };
  if (days < 7) return { label, sub: { kind: 'inDays', days } };
  if (days < 14) return { label, sub: { kind: 'nextWeek' } };
  return { label, sub: { kind: 'inWeeks', weeks: Math.round(days / 7) } };
}

// ── "Latest update" ──

/**
 * One "Latest update" pill: what it says and its tone — the reminder the
 * server sent, a WhatsApp "Yes", a move, a check-in. The plan pills and the
 * reminder's delivered / read went with the backend (G3).
 */
export type LatestUpdate =
  | { kind: 'reminderSent'; tone: 'stone' }
  | { kind: 'repliedYes'; tone: 'lav' }
  | { kind: 'moved'; tone: 'butter'; times: number; from: string | null }
  | { kind: 'checkedIn'; tone: 'mint' };

/** The events a booking has had, oldest to newest — the last is its latest (H:5971). */
function bookingEvents(appointment: AppointmentRow): LatestUpdate[] {
  const events: LatestUpdate[] = [];
  if (appointment.reminder === 'reminder_sent') {
    events.push({ kind: 'reminderSent', tone: 'stone' });
  }
  if (appointment.repliedYes && appointment.status === 'confirmed') {
    events.push({ kind: 'repliedYes', tone: 'lav' });
  }
  if (appointment.moveCount > 0) {
    events.push({
      kind: 'moved',
      tone: 'butter',
      times: appointment.moveCount,
      from: appointment.rescheduledFrom,
    });
  }
  if (appointment.status === 'checked_in' || appointment.status === 'completed') {
    events.push({ kind: 'checkedIn', tone: 'mint' });
  }
  return events;
}

/**
 * The booking's latest event (H:5971) — the Agenda's "Latest update" pill and
 * the card's "last update" line: "Reminder sent", "Replied Yes", "Moved" (×n)
 * or "Checked in"; `null` is "—" in the Agenda, "No update yet" on the card.
 */
export function latestEvent(appointment: AppointmentRow): LatestUpdate | null {
  return bookingEvents(appointment).at(-1) ?? null;
}
