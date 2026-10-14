import type { Tone } from '@/shared/api/app/app-schema.ts';
import { addCivilDays, civilDayOffset } from '@/shared/api/app/app-time.ts';
import type { PickerOption } from '@/shared/components/Picker/picker.types.ts';

/** Days before today the date list reaches by default (H:4453). */
export const DATE_PICKER_PAST_DAYS = 120;
/** Days after today the date list reaches by default (H:4453). */
export const DATE_PICKER_FUTURE_DAYS = 60;

/** The words and formatting a date list needs — from the locale. */
export interface DateOptionFormat {
  today: string;
  tomorrow: string;
  yesterday: string;
  comingUp: string;
  /** "Today · Sat 3 Oct" from "Today" and "Sat 3 Oct". */
  relative: (relative: string, day: string) => string;
  /** A civil date as "Sat 3 Oct" — with the year when `withYear`. */
  day: (date: string, withYear: boolean) => string;
  /** A civil date's month as "Oct 2026" (the past dates' group). */
  month: (date: string) => string;
}

/** The window of dates a list offers. */
export interface DateOptionRange {
  /** Today's civil date, `YYYY-MM-DD`. */
  today: string;
  past?: number;
  future?: number;
  /** Earliest date offered, `YYYY-MM-DD`. */
  min?: string;
  /** Latest date offered, `YYYY-MM-DD`. */
  max?: string;
}

function relativeWord(offset: number, format: DateOptionFormat): string {
  if (offset === 0) return format.today;
  if (offset === 1) return format.tomorrow;
  if (offset === -1) return format.yesterday;
  return '';
}

function groupOf(date: string, offset: number, format: DateOptionFormat) {
  if (offset === 0) return { group: format.today, tone: 'sage' as Tone };
  if (offset > 0) return { group: format.comingUp, tone: 'sky' as Tone };
  return { group: format.month(date), tone: 'stone' as Tone };
}

/**
 * One date option (H:4454): "Today · Sat 3 Oct", "Tomorrow · Sun 4 Oct",
 * "Yesterday · Fri 2 Oct" or "Mon 5 Oct" (the year added outside this year),
 * grouped Today (sage) · Coming up (sky) · its month (stone). The key is the
 * civil date; the ISO form is a search keyword.
 */
export function dateOption(
  date: string,
  today: string,
  format: DateOptionFormat,
): PickerOption<string> {
  const offset = civilDayOffset(today, date);
  const withYear = date.slice(0, 4) !== today.slice(0, 4);
  const day = format.day(date, withYear);
  const relative = relativeWord(offset, format);
  const { group, tone } = groupOf(date, offset, format);
  return {
    key: date,
    label: relative ? format.relative(relative, day) : day,
    group,
    tone,
    keywords: [date],
    data: date,
  };
}

/**
 * The date list (H:4453): today, the next `future` days, then the past
 * `past` days newest first — clipped to `min` / `max`.
 */
export function buildDateOptions(
  range: DateOptionRange,
  format: DateOptionFormat,
): PickerOption<string>[] {
  const past = range.past ?? DATE_PICKER_PAST_DAYS;
  const future = range.future ?? DATE_PICKER_FUTURE_DAYS;
  const offsets = [
    0,
    ...Array.from({ length: future }, (_, index) => index + 1),
    ...Array.from({ length: past }, (_, index) => -(index + 1)),
  ];
  return offsets
    .map((offset) => addCivilDays(range.today, offset))
    .filter((date) => withinRange(date, range))
    .map((date) => dateOption(date, range.today, format));
}

/** Whether `date` lies inside `min` / `max` (both optional, inclusive). */
export function withinRange(
  date: string,
  range: { min?: string; max?: string },
): boolean {
  if (range.min && date < range.min) return false;
  return !(range.max && date > range.max);
}

/** How the user's locale writes dates, for {@link parseTypedDate}. */
export interface TypedDateLocale {
  /** Lower-case month names per month (index 0 = January), any lengths. */
  months: readonly (readonly string[])[];
  /** Numeric dates read day first: 12/9 is 12 September. */
  dayFirst: boolean;
  /**
   * Lower-case weekday names per day (index 0 = Sunday), any lengths — "fri", "next friday"
   * (feat-write-less). English is used when left out.
   */
  weekdays?: readonly (readonly string[])[];
}

/** English weekday names (index 0 = Sunday), always understood alongside the locale's. */
export const ENGLISH_WEEKDAY_NAMES: readonly (readonly string[])[] = [
  ['sun', 'sunday'],
  ['mon', 'monday'],
  ['tue', 'tues', 'tuesday'],
  ['wed', 'wednesday'],
  ['thu', 'thur', 'thurs', 'thursday'],
  ['fri', 'friday'],
  ['sat', 'saturday'],
];

/** English month names, always understood alongside the locale's. */
export const ENGLISH_MONTH_NAMES: readonly (readonly string[])[] = [
  ['jan', 'january'],
  ['feb', 'february'],
  ['mar', 'march'],
  ['apr', 'april'],
  ['may'],
  ['jun', 'june'],
  ['jul', 'july'],
  ['aug', 'august'],
  ['sep', 'sept', 'september'],
  ['oct', 'october'],
  ['nov', 'november'],
  ['dec', 'december'],
];

const NUMERIC = /^\d+$/;

/** The month a word names: an exact name, or a prefix of 3+ letters naming one month only. */
function monthIndex(word: string, locale: TypedDateLocale): number {
  const typed = word.replace(/\.$/, '');
  const hits = new Set<number>();
  locale.months.forEach((names, index) => {
    const named = names.some(
      (name) => name === typed || (typed.length >= 3 && name.startsWith(typed)),
    );
    if (named) hits.add(index);
  });
  const [only] = hits;
  return hits.size === 1 && only !== undefined ? only : -1;
}

/** `YYYY-MM-DD` for a real calendar day, else `null` (31 Feb, month 13). */
function civilOf(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** The day-and-month in whichever of last, this or next year lies nearest today. */
function nearestYear(today: string, month: number, day: number): string | null {
  const year = Number(today.slice(0, 4));
  let best: string | null = null;
  for (const candidate of [year - 1, year, year + 1]) {
    const date = civilOf(candidate, month, day);
    if (!date) continue;
    if (
      best === null ||
      Math.abs(civilDayOffset(today, date)) < Math.abs(civilDayOffset(today, best))
    ) {
      best = date;
    }
  }
  return best;
}

function fullYear(token: string): number {
  const year = Number(token);
  return token.length <= 2 ? 2000 + year : year;
}

function fromNumbers(
  numbers: number[],
  tokens: string[],
  today: string,
  dayFirst: boolean,
) {
  const [first = 0, second = 0] = numbers;
  if (tokens[0]?.length === 4 && numbers.length === 3) {
    return civilOf(first, second, numbers[2] ?? 0);
  }
  const day = dayFirst ? first : second;
  const month = dayFirst ? second : first;
  if (numbers.length === 3) return civilOf(fullYear(tokens[2] ?? ''), month, day);
  return nearestYear(today, month, day);
}

function fromWords(tokens: string[], today: string, locale: TypedDateLocale) {
  const [first = '', second = '', third] = tokens;
  const dayFirst = NUMERIC.test(first);
  const day = Number(dayFirst ? first : second);
  const month = monthIndex(dayFirst ? second : first, locale) + 1;
  if (month === 0 || !NUMERIC.test(dayFirst ? first : second)) return null;
  if (third === undefined) return nearestYear(today, month, day);
  return NUMERIC.test(third) ? civilOf(fullYear(third), month, day) : null;
}

/** The units a relative date counts in, by what may be typed for each. */
const RELATIVE_UNITS: Readonly<Record<string, 'day' | 'week' | 'month' | 'year'>> = {
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  wk: 'week',
  wks: 'week',
  week: 'week',
  weeks: 'week',
  m: 'month',
  mo: 'month',
  mos: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  yr: 'year',
  yrs: 'year',
  year: 'year',
  years: 'year',
};

/** The English words for the days next to today. */
const NEXT_TO_TODAY: Readonly<Record<string, number>> = {
  today: 0,
  tomorrow: 1,
  tmrw: 1,
  yesterday: -1,
};

/** `date` moved by whole months, the day kept or clamped to the month's last (31 Jan + 1m = 28 Feb). */
function addCivilMonths(date: string, months: number): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  first.setUTCDate(Math.min(day, last.getUTCDate()));
  return first.toISOString().slice(0, 10);
}

/**
 * An amount and unit — "3d", "+10", "2weeks", "-2d" — counted from today, or `null`.
 *
 * @param count.text - The amount and unit, spaces removed.
 * @param count.direction - `-1` for "… ago".
 * @param count.counting - "in" or "ago" was typed: a bare figure counts days.
 */
function fromCount({
  text,
  today,
  direction,
  counting,
}: {
  text: string;
  today: string;
  direction: 1 | -1;
  counting: boolean;
}): string | null {
  const match = /^([+-]?)(\d{1,3})([a-z]*)$/.exec(text);
  if (!match) return null;
  const [, sign = '', digits = '', unitWord = ''] = match;
  // A bare figure is a day of the month elsewhere: only a sign, "in" or "ago" makes it a count.
  if (!unitWord && !sign && !counting) return null;
  const unit = unitWord ? RELATIVE_UNITS[unitWord] : 'day';
  if (!unit) return null;
  const amount = Number(digits) * (sign === '-' ? -1 : 1) * direction;
  if (unit === 'day') return addCivilDays(today, amount);
  if (unit === 'week') return addCivilDays(today, amount * 7);
  return addCivilMonths(today, unit === 'month' ? amount : amount * 12);
}

/** The weekday a word names (an exact name, or a prefix of 3+ letters naming one day), or -1. */
function weekdayIndex(word: string, locale: TypedDateLocale): number {
  const typed = word.replace(/\.$/, '');
  const names = (locale.weekdays ?? []).map((own, index) => [
    ...own,
    ...(ENGLISH_WEEKDAY_NAMES[index] ?? []),
  ]);
  const hits = new Set<number>();
  (names.length ? names : ENGLISH_WEEKDAY_NAMES).forEach((day, index) => {
    if (
      day.some((name) => name === typed || (typed.length >= 3 && name.startsWith(typed)))
    ) {
      hits.add(index);
    }
  });
  const [only] = hits;
  return hits.size === 1 && only !== undefined ? only : -1;
}

/**
 * Read a relative date (feat-write-less-2026-10-14-oixr, D10): `today`, `tomorrow`, `yesterday`;
 * a count — `3d`, `2w`, `1m`, `1y`, `+10`, `-2d`, `in 3 days`, `2 weeks ago`; or a weekday — `fri`,
 * `friday`, `next fri` — the next such day after today. English words and the `d / w / m / y`
 * units always work, plus the locale's weekday names.
 *
 * @param query - What was typed.
 * @param today - The clinic's civil today, `YYYY-MM-DD`.
 * @param locale - The locale's weekday names.
 * @returns The civil date, or `null` when the text is not a relative date.
 */
export function parseRelativeDate(
  query: string,
  today: string,
  locale: TypedDateLocale,
): string | null {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const [first = ''] = words;
  const next = NEXT_TO_TODAY[first];
  if (words.length === 1 && next !== undefined) return addCivilDays(today, next);
  const lead = ['in', 'next', 'this'].includes(first) ? first : '';
  const rest = lead ? words.slice(1) : words;
  const ago = rest.at(-1) === 'ago';
  const counted = ago ? rest.slice(0, -1) : rest;
  if (counted.length === 0 || counted.length > 2) return null;
  const weekday = fromWeekday({ words: counted, today, locale, ago });
  if (weekday) return weekday;
  if (lead === 'next' || lead === 'this') return null;
  return fromCount({
    text: counted.join(''),
    today,
    direction: ago ? -1 : 1,
    counting: lead === 'in' || ago,
  });
}

/** One weekday word — "fri", "friday" — as the next such day after today, or `null`. */
function fromWeekday({
  words,
  today,
  locale,
  ago,
}: {
  words: readonly string[];
  today: string;
  locale: TypedDateLocale;
  ago: boolean;
}): string | null {
  if (words.length !== 1 || ago) return null;
  const weekday = weekdayIndex(words[0] ?? '', locale);
  if (weekday < 0) return null;
  const from = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addCivilDays(today, (weekday - from + 7) % 7 || 7);
}

/**
 * Read a typed date — "12 sep", "sep 12", "12 september 2026", "12/9",
 * "12/09/26", "2026-09-12" — in the locale's day/month order and month names
 * (English names always work). Without a year, the nearest such day to today
 * wins. A relative date — "3d", "2w", "fri", "in 2 weeks" — reads through
 * {@link parseRelativeDate} first. Returns the civil date, or `null` when the
 * text is not a date.
 */
export function parseTypedDate(
  query: string,
  today: string,
  locale: TypedDateLocale,
): string | null {
  const relative = parseRelativeDate(query, today, locale);
  if (relative) return relative;
  const tokens = query
    .trim()
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .split(/[\s,/.-]+/)
    .filter(Boolean);
  if (tokens.length < 2 || tokens.length > 3) return null;
  if (tokens.every((token) => NUMERIC.test(token))) {
    return fromNumbers(tokens.map(Number), tokens, today, locale.dayFirst);
  }
  return fromWords(tokens, today, locale);
}
