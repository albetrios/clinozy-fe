import {
  addCivilDays,
  appClockTime,
  appInstant,
  appToday,
} from '@/shared/api/app/app-time.ts';

/** A follow-up time as the picker holds it: the clinic's day (`YYYY-MM-DD`) and clock (`HH:mm`). */
export interface FollowUpParts {
  date: string;
  time: string;
}

/** The clock a follow-up takes when nobody chose one — the morning call. */
const FOLLOW_UP_DEFAULT_TIME = '11:00';

/** "Later today" — 5 pm, offered while it is still ahead. */
const LATER_TODAY_TIME = '17:00';

/** The days a lead closed as Lost or Not interested is won back at a check-in (clinozy-be D2). */
export const LEAD_WIN_BACK_DAYS = 90;

/** A follow-up's day and clock: its own while still ahead, else tomorrow at 11:00. */
export function followUpPartsOf(
  instant: string | null,
  now: Date = new Date(),
): FollowUpParts {
  if (instant !== null && new Date(instant).getTime() > now.getTime()) {
    const at = new Date(instant);
    return { date: appToday(at), time: appClockTime(at) };
  }
  return { date: addCivilDays(appToday(now), 1), time: FOLLOW_UP_DEFAULT_TIME };
}

/** The instant `follow_up_at` carries for a picked day and clock. */
export function followUpInstant(parts: FollowUpParts): string {
  return appInstant(parts.date, parts.time);
}

/** "No answer": the next try is tomorrow at the clock the follow-up had (11:00 without one). */
export function nextTryAt(followUpAt: string | null, now: Date = new Date()): string {
  const time =
    followUpAt === null ? FOLLOW_UP_DEFAULT_TIME : appClockTime(new Date(followUpAt));
  return appInstant(addCivilDays(appToday(now), 1), time);
}

/** One quick pick of the follow-up picker. */
export type FollowUpPickId = 'laterToday' | 'tomorrow' | 'inThreeDays' | 'nextWeek';

/** The quick picks, Later today only while 5 pm is still ahead. */
export function followUpPicks(
  now: Date = new Date(),
): { id: FollowUpPickId; parts: FollowUpParts }[] {
  const today = appToday(now);
  const at = (days: number) => ({
    date: addCivilDays(today, days),
    time: FOLLOW_UP_DEFAULT_TIME,
  });
  return [
    ...(appClockTime(now) < LATER_TODAY_TIME
      ? [{ id: 'laterToday' as const, parts: { date: today, time: LATER_TODAY_TIME } }]
      : []),
    { id: 'tomorrow', parts: at(1) },
    { id: 'inThreeDays', parts: at(3) },
    { id: 'nextWeek', parts: at(7) },
  ];
}

/** The last day a check-in still wins back a lead that closed at `closedAt` (clinozy-be D2). */
export function winBackUntil(closedAt: string): string {
  return addCivilDays(appToday(new Date(closedAt)), LEAD_WIN_BACK_DAYS);
}
