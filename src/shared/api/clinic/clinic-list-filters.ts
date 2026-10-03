/*
 * The shared list contract's date filters (`schema-routes.md` › Operations,
 * `S:1541–1542`): `created` on `createdAt` and `followUp` on the follow-up date,
 * each a preset or a custom range. One value form for the URL and the list
 * reads — the preset's machine value, or `YYYY-MM-DD..YYYY-MM-DD` for the
 * contract's `range(from,to)` with either end left open (the design's "From" /
 * "To" pickers, `leads.md:180`).
 *
 * Dependency-free on purpose: the rooms' URL search schemas read it, and those
 * run in the router (`routeTree.tsx` is the entry chunk). The matching lives in
 * `clinic-filter-match.ts`.
 */

/** The Created presets ("Any" is no filter). */
export const CREATED_PRESETS = [
  'today',
  'yesterday',
  'last_7',
  'last_30',
  'this_month',
] as const;

/** One Created preset. */
export type CreatedPreset = (typeof CREATED_PRESETS)[number];

/** The Follow-up presets ("Any" is no filter; `not_set` is no date). */
export const FOLLOW_UP_PRESETS = [
  'overdue',
  'today',
  'tomorrow',
  'next_7',
  'not_set',
] as const;

/** One Follow-up preset. */
export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number];

/** A custom range, `from..to` (`YYYY-MM-DD`, clinic-local; either end may be empty). */
export type DateRange = `${string}..${string}`;

/** A Created filter: a preset or a custom range. */
export type CreatedFilter = CreatedPreset | DateRange;

/** A Follow-up filter: a preset or a custom range. */
export type FollowUpFilter = FollowUpPreset | DateRange;

/** A calendar day, `YYYY-MM-DD` (clinic-local) — a range's end, a room's `?date=`. */
export const CALENDAR_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * The two ends of a custom range — `null` for an open end — or `null` when the
 * value is not a range: no `..`, a malformed date, both ends open, or the
 * start after the end.
 */
export function dateRangeOf(
  value: string,
): { from: string | null; to: string | null } | null {
  const parts = value.split('..');
  if (parts.length !== 2) return null;
  const [from = '', to = ''] = parts;
  if ((from && !CALENDAR_DATE.test(from)) || (to && !CALENDAR_DATE.test(to))) return null;
  if (!(from || to)) return null;
  if (from && to && from > to) return null;
  return { from: from || null, to: to || null };
}

/** A custom range's value from its two ends (`null` = open). */
export function toDateRange(from: string | null, to: string | null): DateRange {
  return `${from ?? ''}..${to ?? ''}`;
}

/** `value` as one of `presets` or a valid custom range; `undefined` for anything else ("any" included). */
function readDateFilter<P extends string>(
  value: unknown,
  presets: readonly P[],
): P | DateRange | undefined {
  if (typeof value !== 'string') return undefined;
  if ((presets as readonly string[]).includes(value)) return value as P;
  return dateRangeOf(value) ? (value as DateRange) : undefined;
}

/** A URL or list-param value as a Created filter; `undefined` when it is none. */
export function readCreatedFilter(value: unknown): CreatedFilter | undefined {
  return readDateFilter(value, CREATED_PRESETS);
}

/** A URL or list-param value as a Follow-up filter; `undefined` when it is none. */
export function readFollowUpFilter(value: unknown): FollowUpFilter | undefined {
  return readDateFilter(value, FOLLOW_UP_PRESETS);
}
