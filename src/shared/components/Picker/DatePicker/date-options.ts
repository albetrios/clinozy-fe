import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { addCivilDays } from '@/shared/api/clinic/clinic-time.ts';
import type { PickerOption } from '@/shared/components/Picker/picker.types.ts';

/** Days before today the date list reaches by default (H:4453). */
export const DATE_PICKER_PAST_DAYS = 120;
/** Days after today the date list reaches by default (H:4453). */
export const DATE_PICKER_FUTURE_DAYS = 60;

const DAY_MS = 86_400_000;

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

function civilParts(date: string): [number, number, number] {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return [year, month, day];
}

/** A civil date as a local-midnight `Date` (what calendars and `civilDay` formatting take). */
export function localDateOf(date: string): Date {
  const [year, month, day] = civilParts(date);
  return new Date(year, month - 1, day);
}

/** The civil date of a local `Date`, `YYYY-MM-DD`. */
export function civilDateOf(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (civil dates; negative when `to` is earlier). */
export function civilDayOffset(from: string, to: string): number {
  const [fy, fm, fd] = civilParts(from);
  const [ty, tm, td] = civilParts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
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
  const withYear = civilParts(date)[0] !== civilParts(today)[0];
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
}

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
  const [year] = civilParts(today);
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

/**
 * Read a typed date — "12 sep", "sep 12", "12 september 2026", "12/9",
 * "12/09/26", "2026-09-12" — in the locale's day/month order and month names
 * (English names always work). Without a year, the nearest such day to today
 * wins. Returns the civil date, or `null` when the text is not a date.
 */
export function parseTypedDate(
  query: string,
  today: string,
  locale: TypedDateLocale,
): string | null {
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
