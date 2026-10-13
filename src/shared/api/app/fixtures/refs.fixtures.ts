import {
  fixtureUuid,
  parseSeedDisplayDate,
  PROTOTYPE_SEED_DAY,
  seedDate,
  seedInstant,
  seedPhone,
} from '@/shared/api/app/app-fixture-seed.ts';
import { addCivilDays, appToday } from '@/shared/api/app/app-time.ts';

/**
 * Shared plumbing of the clinic fixture world (REPLACE_WITH_API): the stable id
 * of every record and the readers that turn the prototype's display strings
 * into contract values.
 *
 * Every id is `fixtureUuid(<kind>, <prototype key>)`, so one fixture file can
 * point at a record another file seeds without importing it — the files form a
 * one-way chain and never import each other in a cycle.
 */
export const ref = {
  branch: (key: number) => fixtureUuid('branch', key),
  user: (seq: number) => fixtureUuid('user', seq),
  patient: (seq: number) => fixtureUuid('patient', seq),
  lead: (seq: number) => fixtureUuid('lead', seq),
  leadMessage: (key: string) => fixtureUuid('lead-message', key),
  appointment: (seq: number) => fixtureUuid('appointment', seq),
  prescription: (seq: number) => fixtureUuid('prescription', seq),
  treatment: (key: number) => fixtureUuid('treatment', key),
  patientImage: (key: number) => fixtureUuid('patient-image', key),
  patientReport: (key: number) => fixtureUuid('patient-report', key),
  patientPackage: (key: number) => fixtureUuid('patient-package', key),
  patientNote: (key: number) => fixtureUuid('patient-note', key),
  checkIn: (key: number) => fixtureUuid('check-in', key),
  review: (key: number) => fixtureUuid('review', key),
  offering: (seq: number) => fixtureUuid('offering', seq),
  invoice: (seq: number) => fixtureUuid('invoice', seq),
  payment: (seq: number) => fixtureUuid('payment', seq),
  task: (key: string) => fixtureUuid('task', key),
} as const;

/** A lookup that must hit — a miss is a broken seed, so it fails loudly. */
export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Clinic fixture world: unknown ${what}`);
  return value;
}

/** Rupees as the contract's integer paise. */
export const paise = (rupees: number): number => Math.round(rupees * 100);

/**
 * A prototype date label on the prototype's own calendar: "Today 07:00",
 * "Yesterday 3:30 pm", "24 Sep 4:34 pm", "Sep 24 · 14:50", "17 Sep 2026",
 * "Jul 07, 2025 · 11:01" and the ISO forms "2026-09-26", "2026-09-26 17:26" and
 * "2026-09-26 · 17:26".
 */
export function readSeedLabel(label: string): { date: string; time: string | null } {
  const text = label.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const time = text.slice(10).replace('·', '').trim();
    return { date: text.slice(0, 10), time: time || null };
  }
  return must(
    parseSeedDisplayDate(withTimeDot(text)) ?? undefined,
    `seed date "${label}"`,
  );
}

/** "24 Sep 4:34 pm" → "24 Sep · 4:34 pm", the separator `parseSeedDisplayDate` reads. */
function withTimeDot(text: string): string {
  if (text.includes('·')) return text;
  const words = text.split(' ');
  const clock = words.findIndex((word) => /^\d{1,2}:\d{2}$/.test(word));
  return clock < 1
    ? text
    : `${words.slice(0, clock).join(' ')} · ${words.slice(clock).join(' ')}`;
}

/** A prototype date label as a clinic-local calendar date, shifted onto today. */
export function seedDay(label: string, today: string = appToday()): string {
  return seedDate(readSeedLabel(label).date, today);
}

/** A prototype date label as a UTC instant, shifted onto today; `fallbackTime` when it has no time. */
export function seedAt(
  label: string,
  fallbackTime: string,
  today: string = appToday(),
): string {
  const { date, time } = readSeedLabel(label);
  return seedInstant(date, time ?? fallbackTime, today);
}

/** An instant moved by whole seconds — keeps same-minute seeds in their order. */
export function secondsLater(instant: string, seconds: number): string {
  return new Date(Date.parse(instant) + seconds * 1000).toISOString();
}

/**
 * The prototype date a booking was made on: three days ahead of the visit, or
 * the day before the seed day for later visits (the seeds don't say).
 */
export function bookedOn(visitDate: string): string {
  const ahead = addCivilDays(visitDate, -3);
  const yesterday = addCivilDays(PROTOTYPE_SEED_DAY, -1);
  return ahead < yesterday ? ahead : yesterday;
}

/**
 * A displayed mobile as E.164. A few prototype placeholders ("33333 33333",
 * "38288 52399") start below 6, which no Indian mobile does, so their leading
 * digit becomes 9 to meet the contract's `^\+91[6-9]\d{9}$`.
 */
export function seedMobile(display: string): string {
  const mobile = seedPhone(display);
  return /^\+91[6-9]/.test(mobile) ? mobile : `+919${mobile.slice(4)}`;
}
