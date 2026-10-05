import { zonedClockParts } from '@/lib/i18n/format.ts';

import type { Weekday } from './clinic-schema.ts';

/**
 * The clinic clock. Calendar dates (`YYYY-MM-DD`) and clock times (`HH:mm`) in
 * the contract are clinic-local (`schema-routes.md` conventions); instants are
 * ISO UTC. The org's timezone is `Asia/Kolkata` by default — the real clock,
 * never the prototype's simulated one (D15).
 */
export const CLINIC_TIME_ZONE = 'Asia/Kolkata';

const pad = (value: number) => String(value).padStart(2, '0');

/** Today's clinic-local calendar date, `YYYY-MM-DD`. */
export function clinicToday(now: Date = new Date(), timeZone = CLINIC_TIME_ZONE): string {
  const p = zonedClockParts(now, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The clinic-local `HH:mm` of an instant. */
export function clinicClockTime(instant: Date, timeZone = CLINIC_TIME_ZONE): string {
  const p = zonedClockParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Minutes after midnight of a clock time `HH:mm` — the unit slot and overlap arithmetic runs in. */
export function clockMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** The clock time `HH:mm` of a count of minutes after midnight. */
export function clockOfMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

const DAY_MS = 86_400_000;

function civilParts(date: string): [number, number, number] {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return [year, month, day];
}

/**
 * A calendar date as a local-midnight `Date` — what calendars take, and what
 * `formatDate(…, { civilDay: true })` keeps on its day whatever the viewer's
 * display timezone.
 */
export function localDateOf(date: string): Date {
  const [year, month, day] = civilParts(date);
  return new Date(year, month - 1, day);
}

/** The calendar date of a local `Date`, `YYYY-MM-DD`. */
export function civilDateOf(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (calendar dates; negative when `to` is earlier). */
export function civilDayOffset(from: string, to: string): number {
  const [fy, fm, fd] = civilParts(from);
  const [ty, tm, td] = civilParts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/**
 * Where a calendar date sits from today, as the rooms name a moment (the one
 * time rule): today; yesterday; two to six days back (`thisWeek` — its
 * weekday names it); a week or more back (`earlier` — its date, the time
 * dropped); tomorrow; two or more days ahead (`ahead` — its date, the time
 * kept). A weekday only ever names a past day, so "Mon" never reads as next
 * Monday.
 */
export type CivilDayReading =
  'today' | 'yesterday' | 'thisWeek' | 'earlier' | 'tomorrow' | 'ahead';

/** How many days back a weekday still names the day: within the last six. */
const THIS_WEEK_DAYS = 6;

/** How {@link CivilDayReading} reads `date` on the day `today` (calendar dates). */
export function civilDayReading(today: string, date: string): CivilDayReading {
  const offset = civilDayOffset(today, date);
  if (offset === 0) return 'today';
  if (offset === -1) return 'yesterday';
  if (offset === 1) return 'tomorrow';
  if (offset > 1) return 'ahead';
  return -offset <= THIS_WEEK_DAYS ? 'thisWeek' : 'earlier';
}

/** Whole years from one calendar date to another — an age on a given day. */
export function civilYearsBetween(from: string, to: string): number {
  const [fromYear = 0, fromMonth = 0, fromDay = 0] = from.split('-').map(Number);
  const [toYear = 0, toMonth = 0, toDay = 0] = to.split('-').map(Number);
  const beforeBirthday =
    toMonth < fromMonth || (toMonth === fromMonth && toDay < fromDay);
  return toYear - fromYear - (beforeBirthday ? 1 : 0);
}

/** A calendar date `days` away from `date` (civil arithmetic — no timezone involved). */
export function addCivilDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return next.toISOString().slice(0, 10);
}

/** The first day of a date's calendar month: `2026-10-17` → `2026-10-01`. */
export function civilMonthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/**
 * The same day `months` calendar months away (civil arithmetic), held to the
 * last day of a shorter month: 31 Jan + 1 → 28 or 29 Feb.
 */
export function addCivilMonths(date: string, months: number): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

/** Minutes the zone is ahead of UTC at a given instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedClockParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** The ISO UTC instant of a clinic-local date and `HH:mm`. */
export function clinicInstant(
  date: string,
  time: string,
  timeZone = CLINIC_TIME_ZONE,
): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const naive = Date.UTC(
    year ?? 1970,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
  );
  const offset = offsetMinutes(new Date(naive), timeZone);
  return new Date(naive - offset * 60_000).toISOString();
}

/** The week in the contract's order, Monday first (`S:` `weekday`). */
const WEEK: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * How a working week reads (`usRange`, H:3608): "Every day" for all seven, a
 * run "Mon–Sat" for two or more days in a row, else the days listed — in week
 * order whatever order they were picked in. The screen words each kind.
 */
export type WorkingDaysPattern =
  | { kind: 'none' }
  | { kind: 'everyDay' }
  | { kind: 'run'; from: Weekday; to: Weekday }
  | { kind: 'list'; days: Weekday[] };

/** The reading of a set of working days — see {@link WorkingDaysPattern}. */
export function workingDaysPattern(days: readonly Weekday[]): WorkingDaysPattern {
  const sorted = WEEK.filter((day) => days.includes(day));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return { kind: 'none' };
  if (sorted.length === WEEK.length) return { kind: 'everyDay' };
  const contiguous =
    sorted.length > 1 && WEEK.indexOf(last) - WEEK.indexOf(first) === sorted.length - 1;
  return contiguous
    ? { kind: 'run', from: first, to: last }
    : { kind: 'list', days: sorted };
}
