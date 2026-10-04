/**
 * The calendars' geometry and load rules (KICKOFF §6.4 Day · Week · Month;
 * H:5920–5952): the hour rail, where a block sits, how overlapping bookings
 * split a column into lanes, a day's load, how many chips a Month cell holds,
 * the now line and the slot an empty-column press books. Pure — the views
 * read them and the tests pin them.
 */
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { clockMinutes, clockOfMinutes } from '@/shared/api/clinic/clinic-time.ts';

// ── The hour rail ──

/** The rail's first hour, 9 am (`H0`, H:5924). */
export const RAIL_FIRST_HOUR = 9;
/** The hour the rail ends at, 10 pm (`H1`, H:5924) — the last label is 9 pm. */
export const RAIL_END_HOUR = 22;
/** One hour on the rail, px (`WPX`, H:5924). */
export const HOUR_HEIGHT = 88;
/** The rail's height: 13 hours of 88px — 1,144px. */
export const RAIL_HEIGHT = (RAIL_END_HOUR - RAIL_FIRST_HOUR) * HOUR_HEIGHT;
/** The hours the rail labels, 9 am … 9 pm. */
export const RAIL_HOURS: readonly number[] = Array.from(
  { length: RAIL_END_HOUR - RAIL_FIRST_HOUR },
  (_, index) => RAIL_FIRST_HOUR + index,
);

/** The px a clock minute sits at below the rail's 9 am. */
const railTop = (minutes: number) => (minutes / 60 - RAIL_FIRST_HOUR) * HOUR_HEIGHT;

/**
 * The now line's top, px below the rail's 9 am (`nowTop`, H:5925) — negative
 * before 9 am; a view draws it on today only, and only when it is below 0.
 */
export function nowLineTop(nowMinutes: number): number {
  return railTop(nowMinutes);
}

/**
 * How far down a day's column the past veil reaches (`pastH`, H:5933): the
 * whole column for a past day, down to the now line today, none for a later
 * day.
 */
export function pastVeil(
  date: string,
  today: string,
  nowMinutes: number,
): 'all' | number {
  if (date < today) return 'all';
  if (date > today) return 0;
  return Math.max(0, nowLineTop(nowMinutes));
}

/**
 * The 15-minute slot an empty-column press books (`onSlot`, H:5952): the
 * press's offset below the rail's top as a clock time, rounded to the nearest
 * quarter hour and kept on the rail (9:00 to 9:45 pm).
 */
export function slotFromPointer(offsetY: number): string {
  const minutes = RAIL_FIRST_HOUR * 60 + (offsetY / HOUR_HEIGHT) * 60;
  const nearest = Math.round(minutes / 15) * 15;
  const first = RAIL_FIRST_HOUR * 60;
  const last = RAIL_END_HOUR * 60 - 15;
  return clockOfMinutes(Math.min(Math.max(nearest, first), last));
}

// ── Blocks and lanes ──

/** What the calendar math reads of a booking. */
export type CalendarBooking = Pick<
  AppointmentRow,
  'id' | 'date' | 'startTime' | 'durationMin' | 'doctorId' | 'status'
>;

/** A booking's span in minutes after midnight; no length counts as 30 (`+a.dur||30`, H:5928). */
function spanOf(booking: Pick<CalendarBooking, 'startTime' | 'durationMin'>) {
  const start = clockMinutes(booking.startTime);
  return { start, end: start + (booking.durationMin || 30) };
}

/** A booking's place among its overlap cluster's lanes. */
export interface LaneSlot {
  /** Its lane, 0 first. */
  lane: number;
  /** How many lanes its cluster needs. */
  lanes: number;
  /** It shares the column with an overlapping booking. */
  clash: boolean;
}

/** The slot of a booking alone in its column. */
export const SOLO_LANE: LaneSlot = { lane: 0, lanes: 1, clash: false };

/**
 * Overlapping bookings split the column into lanes (`laneOf`, H:5928): in
 * start order, a run of bookings that overlap one another is a cluster; each
 * takes the first lane free by its start, or a new one, and every booking of
 * the cluster gets the cluster's lane count.
 */
export function laneLayout(
  bookings: readonly Pick<CalendarBooking, 'id' | 'startTime' | 'durationMin'>[],
): Map<string, LaneSlot> {
  const spans = bookings
    .map((booking) => ({ id: booking.id, ...spanOf(booking) }))
    .sort((left, right) => left.start - right.start);
  const slots = new Map<string, LaneSlot>();
  let cluster: { id: string; start: number; end: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const span of cluster) {
      let lane = ends.findIndex((end) => end <= span.start);
      if (lane < 0) {
        lane = ends.length;
        ends.push(span.end);
      } else {
        ends[lane] = span.end;
      }
      span.lane = lane;
    }
    for (const span of cluster) {
      slots.set(span.id, { lane: span.lane, lanes: ends.length, clash: ends.length > 1 });
    }
    cluster = [];
    clusterEnd = -1;
  };
  for (const span of spans) {
    if (cluster.length > 0 && span.start >= clusterEnd) flush();
    cluster.push({ ...span, lane: 0 });
    clusterEnd = Math.max(clusterEnd, span.end);
  }
  if (cluster.length > 0) flush();
  return slots;
}

/** A block under this height is one line (`chipOf`'s `hpx < 40`, H:5929; `appointments.md:47`). */
export const ONE_LINE_BELOW = 40;

/** Where a block sits in its column. */
export interface BlockGeometry {
  /** px below the rail's 9 am. */
  top: number;
  /** px: `max(22, length / 60 × 88 − 2)`. */
  height: number;
  /** Under 40px: name, doctor, time and pills on one line. */
  oneLine: boolean;
  /** The inline-start offset, a CSS length: 3px in, then the lane's share. */
  insetInlineStart: string;
  /** The width, a CSS length: the lane's share less a 2px gutter. */
  width: string;
}

/** A block's place in its column from its time, its length and its lane (`blockGeo`, H:5930). */
export function blockGeometry(
  booking: Pick<CalendarBooking, 'startTime' | 'durationMin'>,
  slot: LaneSlot = SOLO_LANE,
): BlockGeometry {
  const height = Math.max(22, (booking.durationMin / 60) * HOUR_HEIGHT - 2);
  return {
    top: railTop(clockMinutes(booking.startTime)),
    height,
    oneLine: height < ONE_LINE_BELOW,
    insetInlineStart: `calc(3px + (100% - 6px) * ${slot.lane} / ${slot.lanes})`,
    width: `calc((100% - 6px) / ${slot.lanes} - 2px)`,
  };
}

// ── Load ──

/** A booking that still holds its slot — every one but a cancelled one. */
const isLive = (booking: Pick<CalendarBooking, 'status'>) =>
  booking.status !== 'cancelled';

/**
 * The live bookings that overlap another live booking of the same doctor —
 * a double-booked doctor (`ovl`, H:5933, H:5939); the Day's blocks say
 * "· overlaps another booking" (H:5930).
 */
export function doubleBookedIds(bookings: readonly CalendarBooking[]): Set<string> {
  const live = bookings.filter(isLive);
  const ids = new Set<string>();
  live.forEach((booking, index) => {
    for (const other of live.slice(index + 1)) {
      if (other.doctorId !== booking.doctorId) continue;
      const a = spanOf(booking);
      const b = spanOf(other);
      if (a.start < b.end && b.start < a.end) {
        ids.add(booking.id);
        ids.add(other.id);
      }
    }
  });
  return ids;
}

/** Whether any doctor is double-booked among `bookings` (the Week dot, the Month dot). */
export function doubleBooked(bookings: readonly CalendarBooking[]): boolean {
  return doubleBookedIds(bookings).size > 0;
}

/**
 * The Day header's load (H:5950): the bookings it shows and their hours, to
 * one decimal — "<n> booked · <h> h"; none is "Free all day".
 */
export function dayLoad(bookings: readonly Pick<CalendarBooking, 'durationMin'>[]): {
  booked: number;
  hours: number;
} {
  const minutes = bookings.reduce((sum, booking) => sum + booking.durationMin, 0);
  return { booked: bookings.length, hours: Math.round((minutes / 60) * 10) / 10 };
}

/** A Week day's load band: sage, butter, blush (H:5933). */
export type LoadTone = 'sage' | 'butter' | 'blush';

/** A Week day header's load bar, tooltip and overlap dot. */
export interface WeekDayLoad {
  /** Live bookings. */
  booked: number;
  /** Their chair time against the day's capacity, 0–100. */
  percent: number;
  tone: LoadTone;
  /** A doctor is double-booked. */
  overlap: boolean;
}

/** The rail's chair hours a day offers each doctor (`H1 − H0`, H:5933). */
const CHAIR_HOURS = RAIL_END_HOUR - RAIL_FIRST_HOUR;

/**
 * A Week day's load (H:5933): its live bookings' chair time against 13 hours
 * × the doctors booked that day (at least two) — sage under 55%, butter to
 * 84%, blush from 85% — and whether a doctor is double-booked.
 */
export function weekLoad(bookings: readonly CalendarBooking[]): WeekDayLoad {
  const live = bookings.filter(isLive);
  const minutes = live.reduce((sum, booking) => sum + (booking.durationMin || 30), 0);
  const doctors = Math.max(2, new Set(live.map((booking) => booking.doctorId)).size);
  const percent = Math.min(
    100,
    Math.round((minutes / (CHAIR_HOURS * 60 * doctors)) * 100),
  );
  let tone: LoadTone = 'sage';
  if (percent >= 85) tone = 'blush';
  else if (percent >= 55) tone = 'butter';
  return { booked: live.length, percent, tone, overlap: doubleBooked(bookings) };
}

/**
 * How many dots a day's load earns in the Filters calendar (H:5923): one up
 * to 6 bookings, two for 7–12, three above 12 — none for a free day.
 */
export function loadDots(booked: number): 0 | 1 | 2 | 3 {
  if (booked <= 0) return 0;
  if (booked <= 6) return 1;
  return booked <= 12 ? 2 : 3;
}

// ── Month ──

/** A Month chip's height with its gap, px (H:5938). */
export const MONTH_CHIP_HEIGHT = 26;

/**
 * How many chips a Month cell of `cellHeight` px shows (`fitN`, H:5938): all of
 * them when they fit under the date row (the cell's 12px padding, the 18px
 * date row and its 4px gap), else as many as leave a line for "+<n> more" —
 * two while the cell is not measured yet.
 */
export function monthFit(cellHeight: number, count: number): number {
  if (cellHeight <= 0) return Math.min(2, count);
  const room = cellHeight - 12 - 18 - 4;
  if (count * MONTH_CHIP_HEIGHT <= room) return count;
  return Math.max(0, Math.floor((room - 24) / MONTH_CHIP_HEIGHT));
}
