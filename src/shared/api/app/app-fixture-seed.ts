import { FIXTURE_ACTOR_ID, FIXTURE_ORGANIZATION_ID } from './app-fixture-store.ts';
import type { AppCommon } from './app-schema.ts';
import { addCivilDays, appInstant, appToday, civilDayOffset } from './app-time.ts';

/**
 * Helpers that turn the prototype's seed data into contract records.
 *
 * The prototype anchors its seeds to `SEED_BASE` (27 Sep 2026, H:3409) and
 * shifts them so that day is today; the fixtures do the same, on the real
 * clinic clock (D15), so "today's appointments" are always today's.
 */

/** The prototype's seed day (`SEED_BASE`). */
export const PROTOTYPE_SEED_DAY = '2026-09-27';

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

/** A prototype seed date moved so the seed day lands on today. */
export function seedDate(prototypeDate: string, today: string = appToday()): string {
  return addCivilDays(today, civilDayOffset(PROTOTYPE_SEED_DAY, prototypeDate));
}

/** The UTC instant of a prototype seed date and clinic-local `HH:mm`, shifted to today. */
export function seedInstant(
  prototypeDate: string,
  time: string,
  today: string = appToday(),
): string {
  return appInstant(seedDate(prototypeDate, today), time);
}

const pad = (value: number) => String(value).padStart(2, '0');
const RELATIVE_DAYS: Record<string, number> = { today: 0, yesterday: -1, tomorrow: 1 };

/** "Today", "Sep 24", "24 Sep", "17 Sep 2026", "Dec 09, 2025" → a calendar date (2026 by default). */
function parseSeedDay(dayPart: string): string | null {
  const relative = RELATIVE_DAYS[dayPart.toLowerCase()];
  if (relative !== undefined) return addCivilDays(PROTOTYPE_SEED_DAY, relative);
  const tokens = dayPart.replace(',', '').split(' ').filter(Boolean);
  const monthToken = tokens.find((token) => /^[a-z]/i.test(token));
  const month = monthToken ? MONTHS.indexOf(monthToken.slice(0, 3).toLowerCase()) : -1;
  const day = tokens.find((token) => /^\d{1,2}$/.test(token));
  const year = tokens.find((token) => /^\d{4}$/.test(token)) ?? '2026';
  if (month < 0 || !day || tokens.length > 3) return null;
  return `${year}-${pad(month + 1)}-${day.padStart(2, '0')}`;
}

/** "10:40", "2:50 pm" → a 24h `HH:mm`. */
function parseSeedTime(timePart: string | undefined): string | null {
  if (!timePart) return null;
  const [clock = '', meridiem] = timePart.toLowerCase().split(' ').filter(Boolean);
  const [hours = '', minutes = ''] = clock.split(':');
  if (!(/^\d{1,2}$/.test(hours) && /^\d{2}$/.test(minutes))) return null;
  let hour = Number(hours);
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return `${pad(hour)}:${minutes}`;
}

/**
 * The prototype's display dates — "Today · 10:40", "Sep 24 · 14:50",
 * "24 Sep", "17 Sep 2026", "Dec 09, 2025 · 10:38", "Today · 11:00 am" — as a
 * prototype calendar date (2026 unless a year is given) and a 24h time.
 */
export function parseSeedDisplayDate(
  display: string,
): { date: string; time: string | null } | null {
  const [dayPart = '', timePart] = display.split('·').map((part) => part.trim());
  const date = parseSeedDay(dayPart);
  return date ? { date, time: parseSeedTime(timePart) } : null;
}

/** A displayed Indian mobile ("98250 44120", "+91 98250 44120") as E.164. */
export function seedPhone(display: string): string {
  const digits = display.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return `+91${digits}`;
}

/**
 * A stable uuid for a fixture record — the same kind and key give the same id
 * on every load, so deep links and tests can name records. Shaped as a v4
 * uuid (version and variant bits set) so the contract's `z.uuid()` accepts it.
 */
export function fixtureUuid(kind: string, key: string | number): string {
  const input = `${kind}:${key}`;
  const words: string[] = [];
  for (let round = 0; round < 4; round += 1) {
    let hash = 0x811c9dc5 ^ (round * 0x9e3779b9);
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    words.push((hash >>> 0).toString(16).padStart(8, '0'));
  }
  const hex = words.join('');
  const variant = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Audit fields for a seeded record created at `createdAt`. */
export function seedCommon(
  createdAt: string,
  createdById: string = FIXTURE_ACTOR_ID,
  updatedAt: string = createdAt,
): AppCommon {
  return {
    organizationId: FIXTURE_ORGANIZATION_ID,
    createdAt,
    updatedAt,
    createdById,
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
  };
}
