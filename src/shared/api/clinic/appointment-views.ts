import type {
  AppointmentDaySummary,
  AppointmentRow,
  AppointmentView,
} from './appointments-contracts.ts';
import { addCivilDays } from './clinic-time.ts';

/*
 * What each view reads (KICKOFF §6.4): the Agenda pages from today on and
 * groups its rows by day; Day, Week and Month read the range they show. Pure.
 */

/** A calendar view — every view but the Agenda. */
export type AppointmentCalendarView = Exclude<AppointmentView, 'agenda'>;

/** Days from Sunday to a calendar date (Sunday = 0; Q-A10: weeks start on Sunday everywhere). */
export function sundayOffset(date: string): number {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The last day of a date's calendar month. */
function monthEnd(date: string): string {
  const [year = 1970, month = 1] = date.split('-').map(Number);
  const next =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return addCivilDays(next, -1);
}

/**
 * The days a calendar view reads (`listAppointmentsRange`) around its anchor
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
  return { from: `${anchor.slice(0, 7)}-01`, to: monthEnd(anchor) };
}

/** One Agenda day: its rows in the read's order, and its header's counts. */
export interface AppointmentDayGroup {
  date: string;
  rows: AppointmentRow[];
  /** The day's counts across every page (Appendix F) — the loaded rows' when the summary is not in yet. */
  summary: AppointmentDaySummary;
}

/**
 * The Agenda's day groups (the sticky headers): the loaded rows by day in the
 * read's order, each with the day's counts from the per-day summary — a day
 * can straddle two cursor pages, so its header never counts only the rows
 * loaded so far.
 */
export function groupAppointmentsByDay(
  rows: readonly AppointmentRow[],
  summaries: readonly AppointmentDaySummary[] = [],
): AppointmentDayGroup[] {
  const counted = new Map(summaries.map((summary) => [summary.date, summary]));
  const groups: AppointmentDayGroup[] = [];
  for (const row of rows) {
    let group = groups.at(-1);
    if (group?.date !== row.date) {
      group = {
        date: row.date,
        rows: [],
        summary: { date: row.date, total: 0, confirmed: 0, scheduled: 0 },
      };
      groups.push(group);
    }
    group.rows.push(row);
  }
  for (const group of groups) {
    group.summary = counted.get(group.date) ?? {
      date: group.date,
      total: group.rows.length,
      confirmed: group.rows.filter((row) => row.status === 'confirmed').length,
      scheduled: group.rows.filter((row) => row.status === 'scheduled').length,
    };
  }
  return groups;
}
