import {
  APPOINTMENT_COUNTS_MAX_DAYS,
  type AppointmentDayCount,
  type AppointmentRow,
  type AppointmentView,
} from './appointments-contracts.ts';
import { addCivilDays, civilMonthStart } from './clinic-time.ts';

/*
 * What each view reads (KICKOFF §6.4): the Agenda pages from today on, groups
 * its rows by day and reads the day counts for the days it has loaded; Day,
 * Week and Month read the range they show. Pure.
 */

/** A calendar view — every view but the Agenda. */
export type AppointmentCalendarView = Exclude<AppointmentView, 'agenda'>;

/** Days from Sunday to a calendar date (Sunday = 0; Q-A10: weeks start on Sunday everywhere). */
function sundayOffset(date: string): number {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The first day of the month after a date's (`YYYY-MM-01`). */
function nextMonthStart(date: string): string {
  const [year = 1970, month = 1] = date.split('-').map(Number);
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/** The last day of a date's calendar month. */
function monthEnd(date: string): string {
  return addCivilDays(nextMonthStart(date), -1);
}

/** The days of a month (`YYYY-MM-01`), in order (`YYYY-MM-DD`). */
export function monthDays(month: string): string[] {
  const next = nextMonthStart(month);
  const days: string[] = [];
  for (let day = month; day < next; day = addCivilDays(day, 1)) days.push(day);
  return days;
}

/**
 * A month as calendar cells (H:5936) — the Month board's (the month grids are
 * `LocalizedCalendar`): the month's days under Sun–Sat (Q-A10), `null` before
 * the first and after the last so every row has seven.
 */
export function monthCells(anchor: string): (string | null)[] {
  const days = monthDays(civilMonthStart(anchor));
  const first = days[0] ?? anchor;
  const cells: (string | null)[] = [
    ...Array.from({ length: sundayOffset(first) }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * The days a calendar view reads (`fetchAppointmentRange`) around its anchor
 * date: Day the date; Week Sunday to Saturday; Month the calendar month (the
 * board leaves the cells around it blank).
 */
export function appointmentViewRange(
  view: AppointmentCalendarView,
  anchor: string,
): { from: string; to: string } {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') {
    const from = addCivilDays(anchor, -sundayOffset(anchor));
    return { from, to: addCivilDays(from, 6) };
  }
  return { from: civilMonthStart(anchor), to: monthEnd(anchor) };
}

/** One Agenda day: its rows in the read's order, and its header's counts. */
export interface AppointmentDayGroup {
  date: string;
  rows: AppointmentRow[];
  /** The day's counts from the server (`daily-counts`); none while they are not in. */
  counts: AppointmentDayCount | undefined;
}

/**
 * The Agenda's day groups (the sticky headers): the loaded rows by day in the
 * read's order, each with its day's counts from `GET /app/appointments/daily-counts`
 * — a day can straddle two cursor pages, and the counts ignore the status,
 * search and created filters, so a header never counts the loaded rows itself.
 */
export function groupAppointmentsByDay(
  rows: readonly AppointmentRow[],
  counts: readonly AppointmentDayCount[] = [],
): AppointmentDayGroup[] {
  const counted = new Map(counts.map((day) => [day.date, day]));
  const groups: AppointmentDayGroup[] = [];
  for (const row of rows) {
    let group = groups.at(-1);
    if (group?.date !== row.date) {
      group = { date: row.date, rows: [], counts: counted.get(row.date) };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/**
 * The days the Agenda's day counts cover: the one day picked in Filters, else
 * the loaded rows' first day to their last — at most 62 days (the read's cap;
 * a later day's header shows no counts); none before a row has loaded.
 */
export function agendaCountsWindow(
  rows: readonly Pick<AppointmentRow, 'date'>[],
  date?: string,
): { from: string; to: string } | null {
  if (date) return { from: date, to: date };
  const first = rows[0]?.date;
  const last = rows.at(-1)?.date;
  if (!(first && last)) return null;
  const cap = addCivilDays(first, APPOINTMENT_COUNTS_MAX_DAYS - 1);
  return { from: first, to: last < cap ? last : cap };
}
