import { appDateOf } from '@/shared/api/app/app-filter-match.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { civilYearsBetween } from '@/shared/api/app/app-time.ts';

/** Where a follow-up stands against the clinic's today. */
export type FollowUpWhen = 'past' | 'today' | 'future';

/** A follow-up instant against the clinic-local `today` (`YYYY-MM-DD`). */
export function followUpWhen(followUpAt: string, today: string): FollowUpWhen {
  const day = appDateOf(followUpAt);
  if (day < today) return 'past';
  return day === today ? 'today' : 'future';
}

/** The Follow-up badge's tone (`patients.md:28`): blush past, butter today, sky future. */
export const FOLLOW_UP_TONES: Readonly<Record<FollowUpWhen, Tone>> = {
  past: 'blush',
  today: 'butter',
  future: 'sky',
};

/** A patient's age in whole years on `today`, or null without a birth date. */
export function patientAge(dateOfBirth: string | null, today: string): number | null {
  return dateOfBirth ? civilYearsBetween(dateOfBirth, today) : null;
}
