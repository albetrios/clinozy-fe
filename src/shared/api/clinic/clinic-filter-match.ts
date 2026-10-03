import {
  type CreatedFilter,
  dateRangeOf,
  type FollowUpFilter,
} from './clinic-list-filters.ts';
import { addCivilDays, clinicToday } from './clinic-time.ts';

/*
 * How the fixture server answers the shared list contract's date filters
 * (`S:1541–1542`; REPLACE_WITH_API) — day by day on the clinic's calendar, as
 * the prototype's `__czDateOk` does (H:3857): "Last 7 days" is today and the
 * six before it, "Next 7 days" today through a week ahead, a custom range
 * includes both ends. Every room's list reads share these.
 */

/** The clinic-local calendar date of an ISO instant. */
export function clinicDateOf(instant: string): string {
  return clinicToday(new Date(instant));
}

/** Whether `date` falls in a custom range (either end open). */
function inRange(date: string, value: string): boolean {
  const range = dateRangeOf(value);
  if (!range) return false;
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}

/**
 * Whether a record created at `createdAt` passes a Created filter on the
 * clinic's `today` (`YYYY-MM-DD`).
 */
export function createdFilterMatches(
  createdAt: string,
  filter: CreatedFilter,
  today: string,
): boolean {
  const date = clinicDateOf(createdAt);
  switch (filter) {
    case 'today':
      return date === today;
    case 'yesterday':
      return date === addCivilDays(today, -1);
    case 'last_7':
      return date >= addCivilDays(today, -6) && date <= today;
    case 'last_30':
      return date >= addCivilDays(today, -29) && date <= today;
    case 'this_month':
      return date.slice(0, 7) === today.slice(0, 7);
    default:
      return inRange(date, filter);
  }
}

/**
 * Whether a follow-up at `followUpAt` (`null` = none set) passes a Follow-up
 * filter on the clinic's `today`. Only "Not set" matches a record without one.
 */
export function followUpFilterMatches(
  followUpAt: string | null,
  filter: FollowUpFilter,
  today: string,
): boolean {
  if (followUpAt === null) return filter === 'not_set';
  const date = clinicDateOf(followUpAt);
  switch (filter) {
    case 'not_set':
      return false;
    case 'overdue':
      return date < today;
    case 'today':
      return date === today;
    case 'tomorrow':
      return date === addCivilDays(today, 1);
    case 'next_7':
      return date >= today && date <= addCivilDays(today, 7);
    default:
      return inRange(date, filter);
  }
}
