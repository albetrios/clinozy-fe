/**
 * How the Appointments room paints and words a booking (KICKOFF §6.4): the
 * person's avatar tone, the service tone, the Agenda's day-group words and
 * tone, and the "Latest update" pills. Pure — every view (Agenda, the card,
 * the calendar blocks) reads these, and the tests pin them.
 */
import type {
  AppointmentPersonKind,
  AppointmentRow,
  AppointmentStaff,
} from '@/shared/api/clinic/appointments-contracts.ts';
import type { AppointmentType, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { civilDayOffset } from '@/shared/api/clinic/clinic-time.ts';

// ── Names ──

/** A staff member's name as written ("Dr. Drashti Desai"). */
export function staffName(
  staff: Pick<AppointmentStaff, 'firstName' | 'lastName'>,
): string {
  return [staff.firstName, staff.lastName].filter(Boolean).join(' ');
}

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

/**
 * The services the design names, by label (`AP_SVC`, H:3416): Consultation
 * sky, Follow-up mint, Treatment sage, LHR Treatment lav, Peel blush,
 * Hydrafacial mint, Other stone.
 */
const SERVICE_TONES: Readonly<Record<string, Tone>> = {
  consultation: 'sky',
  'follow-up': 'mint',
  treatment: 'sage',
  'lhr treatment': 'lav',
  peel: 'blush',
  hydrafacial: 'mint',
  other: 'stone',
};

/** Each type's tone (`AP_TYPE`, H:3418) — a service the design does not name takes its type's. */
const TYPE_TONES: Readonly<Record<AppointmentType, Tone>> = {
  consultation: 'sky',
  follow_up: 'mint',
  treatment: 'sage',
  package_session: 'lav',
  other: 'stone',
};

/** A booking's service tone: the design's for its label, else its type's. */
export function serviceTone(
  appointment: Pick<AppointmentRow, 'serviceLabel' | 'type'>,
): Tone {
  return (
    SERVICE_TONES[appointment.serviceLabel.trim().toLowerCase()] ??
    TYPE_TONES[appointment.type]
  );
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

/** One "Latest update" pill: what it says and its tone. */
export type LatestUpdate =
  | { kind: 'planReady'; tone: 'sage'; suggestions: number }
  | { kind: 'planPending'; tone: 'butter' }
  | { kind: 'reminderRead'; tone: 'sage' }
  | { kind: 'reminderDelivered'; tone: 'sky' }
  | { kind: 'reminderSent'; tone: 'stone' }
  | { kind: 'repliedYes'; tone: 'lav' }
  | { kind: 'moved'; tone: 'butter'; times: number; from: string | null }
  | { kind: 'checkedIn'; tone: 'mint' };

/** The events a booking has had, oldest to newest — the last is its latest (H:5971). */
function bookingEvents(appointment: AppointmentRow): LatestUpdate[] {
  const events: LatestUpdate[] = [];
  if (appointment.reminder === 'read')
    events.push({ kind: 'reminderRead', tone: 'sage' });
  else if (appointment.reminder === 'delivered') {
    events.push({ kind: 'reminderDelivered', tone: 'sky' });
  } else if (appointment.reminder === 'sent') {
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
 * The booking's latest event alone — the card's "last update" line; `null`
 * is "No update yet".
 */
export function latestEvent(appointment: AppointmentRow): LatestUpdate | null {
  return bookingEvents(appointment).at(-1) ?? null;
}

/**
 * The Agenda's "Latest update" pills (H:5971): the plan's — "✓ Plan ready"
 * once this visit has offering suggestions, else "○ Plan pending" — unless
 * the booking is Cancelled or No show, then its latest event: a reminder read
 * / delivered / sent, "Replied Yes", "Moved" (×n) or "Checked in". None → "—".
 */
export function latestUpdates(appointment: AppointmentRow): LatestUpdate[] {
  const pills: LatestUpdate[] = [];
  const closed = appointment.status === 'cancelled' || appointment.status === 'no_show';
  if (!closed) {
    pills.push(
      appointment.plan.visit > 0
        ? { kind: 'planReady', tone: 'sage', suggestions: appointment.plan.patient }
        : { kind: 'planPending', tone: 'butter' },
    );
  }
  const latest = latestEvent(appointment);
  if (latest) pills.push(latest);
  return pills;
}
