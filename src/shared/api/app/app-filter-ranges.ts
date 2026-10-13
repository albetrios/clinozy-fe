import {
  type CreatedFilter,
  dateRangeOf,
  type FollowUpFilter,
} from './app-list-filters.ts';
import { addCivilDays, addCivilMonths, appInstant, civilMonthStart } from './app-time.ts';

/*
 * The shared list contract's date filters as clinozy-be's instant ranges (`created_from` /
 * `created_to`, `follow_up_at_from` / `follow_up_at_to`): whole days on the clinic's calendar,
 * `from` inclusive and `to` exclusive (the API's `lt`) — "Last 7 days" is today and the six
 * before it, "Next 7 days" today through a week ahead, a custom range includes both its days.
 */

/** An instant range as the API takes it; either end may be open. */
export interface InstantRange {
  from?: string;
  to?: string;
}

/** The start of a clinic day, as an instant. */
const startOf = (date: string) => appInstant(date, '00:00');

/** Whole days `[first, last]` as an instant range. */
const days = (first: string | undefined, last: string | undefined): InstantRange => ({
  from: first ? startOf(first) : undefined,
  to: last ? startOf(addCivilDays(last, 1)) : undefined,
});

/** A custom `from..to` range, or none for a value that is not one. */
function customRange(value: string): InstantRange {
  const range = dateRangeOf(value);
  return range ? days(range.from ?? undefined, range.to ?? undefined) : {};
}

/** A Created filter on the clinic's `today` (`YYYY-MM-DD`). */
export function createdRangeOf(filter: CreatedFilter, today: string): InstantRange {
  switch (filter) {
    case 'today':
      return days(today, today);
    case 'yesterday':
      return days(addCivilDays(today, -1), addCivilDays(today, -1));
    case 'last_7':
      return days(addCivilDays(today, -6), today);
    case 'last_30':
      return days(addCivilDays(today, -29), today);
    case 'this_month': {
      const first = civilMonthStart(today);
      return { from: startOf(first), to: startOf(addCivilMonths(first, 1)) };
    }
    default:
      return customRange(filter);
  }
}

/**
 * A Follow-up filter on the clinic's `today`; null for "Not set" — the API has no filter for a
 * lead without a follow-up (api-integration §8 G2).
 */
export function followUpRangeOf(
  filter: FollowUpFilter,
  today: string,
): InstantRange | null {
  switch (filter) {
    case 'not_set':
      return null;
    case 'overdue':
      return { to: startOf(today) };
    case 'today':
      return days(today, today);
    case 'tomorrow':
      return days(addCivilDays(today, 1), addCivilDays(today, 1));
    case 'next_7':
      return days(today, addCivilDays(today, 7));
    default:
      return customRange(filter);
  }
}
