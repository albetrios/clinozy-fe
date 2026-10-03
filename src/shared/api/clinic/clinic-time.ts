import { zonedClockParts } from '@/lib/i18n/format.ts';

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

/** A calendar date `days` away from `date` (civil arithmetic — no timezone involved). */
export function addCivilDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return next.toISOString().slice(0, 10);
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
