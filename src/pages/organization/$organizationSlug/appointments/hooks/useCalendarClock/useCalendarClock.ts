import {
  clinicClockTime,
  clinicToday,
  clockMinutes,
} from '@/shared/api/clinic/clinic-time.ts';
import { useNow } from '@/shared/hooks/useNow/index.ts';

/** The clinic's clock as the calendars read it. */
export interface CalendarClock {
  /** Today, clinic-local `YYYY-MM-DD`. */
  today: string;
  /** Minutes after the clinic's midnight — the now line and the past veil. */
  minutes: number;
}

/**
 * The clinic's clock for the calendars (H:5925): today and the minutes after
 * midnight in the clinic's timezone — the real clock, never the prototype's
 * simulated one (D15) — moving on every minute so the now line and the past
 * veil follow it.
 */
export function useCalendarClock(): CalendarClock {
  const now = useNow();
  return { today: clinicToday(now), minutes: clockMinutes(clinicClockTime(now)) };
}
