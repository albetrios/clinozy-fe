import { createContext } from 'react';

/**
 * How a month grid looks: `picker` — the date field's popover (CalendarPicker:
 * month and year dropdowns, 34px days); `compact` — the booking step's
 * (H:2779–2781: "‹ October 2026 ›" between 24px arrows, 26px days at 11.5px);
 * `regular` — the Appointments Filters' (H:2000–2007: "‹ Oct 2026 ›" between
 * 32px arrows, 32px days at 13px with room for load dots).
 */
export type CalendarLook = 'picker' | 'compact' | 'regular';

/**
 * What today and the pick wear: `primary` — today grey, the pick dark (the
 * Filters', the date field's); `sky` — both in sky, the pick at 24% of the
 * ink over its tint (the booking step's, H:5999).
 */
export type CalendarTone = 'primary' | 'sky';

/** A day's marks under its number — the Filters' load dots (H:2004). */
export interface CalendarDayDots {
  /** How many dots: one to three. */
  count: 1 | 2 | 3;
  /** The dots' colour, a literal class (`bg-tone-sage-dot`); the pick turns them `canvas`. */
  className: string;
}

/** Test ids of a grid's parts; each day also carries `data-day="YYYY-MM-DD"`. */
export interface CalendarTestIds {
  day?: string;
  previous?: string;
  next?: string;
}

/** What the grid's day and arrow buttons read beyond react-day-picker's own props. */
export interface CalendarParts {
  look: CalendarLook;
  tone: CalendarTone;
  dots?: (isoDate: string) => CalendarDayDots | undefined;
  testIds?: CalendarTestIds;
}

/** The parts' context — module-level so the custom components stay stable across renders. */
export const CalendarPartsContext = createContext<CalendarParts>({
  look: 'picker',
  tone: 'primary',
});
