/**
 * The tour's clinic day, on the viewer's own clock (no session, so no clinic
 * time zone yet: the browser's). Inside clinic hours the day sheet is today,
 * its rows a quarter-hour either side of now; after hours it is tomorrow
 * morning, and Riya books into it.
 */

/** The hour the illustrated clinic opens, local time. */
export const TOUR_OPENS_AT_HOUR = 8;
/** The hour it closes: from here until it opens, the sheet shows tomorrow. */
export const TOUR_CLOSES_AT_HOUR = 21;
/** Where tomorrow's sheet starts: 10:30, a clinic's first consultations. */
const TOMORROW_STARTS_AT = { hours: 10, minutes: 30 } as const;

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
/** Tuesday in `Date#getDay()`: the follow-up call the last chapter sets. */
const FOLLOW_UP_WEEKDAY = 2;
/** A package's next session, three weeks after this one. */
const NEXT_SESSION_DAYS = 21;

/** One clinic day for the tour, built from a moment on the viewer's clock. */
export interface TourDay {
  /** True inside clinic hours: the sheet is today, with a now line. */
  open: boolean;
  /** The row before Riya's: now rounded down to the quarter hour, or tomorrow 10:30. */
  base: Date;
  /** Riya's slot, a quarter hour after {@link TourDay.base}. */
  slot: Date;
  /** The next Tuesday after today (never today): her follow-up call. */
  followUp: Date;
  /** Her package's next session. */
  nextSession: Date;
}

/** `date` moved by `minutes` (negative goes back). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/**
 * The day sheet for `now`. Open from {@link TOUR_OPENS_AT_HOUR} until
 * {@link TOUR_CLOSES_AT_HOUR}; after hours it is the next clinic morning
 * (tomorrow's when it is past closing, today's before opening).
 */
export function buildTourDay(now: Date): TourDay {
  const hour = now.getHours();
  const open = hour >= TOUR_OPENS_AT_HOUR && hour < TOUR_CLOSES_AT_HOUR;
  const base = new Date(now);
  base.setSeconds(0, 0);
  if (open) {
    base.setMinutes(Math.floor(now.getMinutes() / 15) * 15);
  } else {
    if (hour >= TOUR_CLOSES_AT_HOUR) base.setDate(base.getDate() + 1);
    base.setHours(TOMORROW_STARTS_AT.hours, TOMORROW_STARTS_AT.minutes, 0, 0);
  }
  const followUp = new Date(now);
  followUp.setDate(now.getDate() + ((FOLLOW_UP_WEEKDAY - now.getDay() + 7) % 7 || 7));
  return {
    open,
    base,
    slot: addMinutes(base, 15),
    followUp,
    nextSession: addMinutes(base, NEXT_SESSION_DAYS * DAY_MINUTES),
  };
}
