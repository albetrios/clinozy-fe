import { addCivilMonths, civilDayOffset } from '@/shared/api/app/app-time.ts';

/**
 * How long someone has been a patient (H:4971): joined today, whole days
 * below 60, then months of 30.4 days, rounded.
 */
export type PatientTenure =
  { kind: 'today' } | { kind: 'days'; count: number } | { kind: 'months'; count: number };

/** Their tenure on `today`, from the calendar date they became a patient. */
export function patientTenure(since: string, today: string): PatientTenure {
  const days = civilDayOffset(since, today);
  if (days <= 0) return { kind: 'today' };
  if (days < 60) return { kind: 'days', count: days };
  return { kind: 'months', count: Math.round(days / 30.4) };
}

/** The birthday chip shows within this many days (H:4973). */
const BIRTHDAY_HORIZON_DAYS = 45;

/**
 * Days until their next birthday — 0 on the day — or null without a birth
 * date or when it is more than 45 days away (H:4973). A 29 February birthday
 * falls on 28 February in a common year.
 */
export function birthdayInDays(dateOfBirth: string | null, today: string): number | null {
  if (!dateOfBirth) return null;
  const birthYear = Number(dateOfBirth.slice(0, 4));
  const year = Number(today.slice(0, 4));
  const thisYear = addCivilMonths(dateOfBirth, (year - birthYear) * 12);
  const next =
    civilDayOffset(today, thisYear) < 0
      ? addCivilMonths(dateOfBirth, (year + 1 - birthYear) * 12)
      : thisYear;
  const days = civilDayOffset(today, next);
  return days <= BIRTHDAY_HORIZON_DAYS ? days : null;
}

/** A stored phone's last four digits — what a masked number shows ("•••• 3212"). */
export function lastFourDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-4);
}
