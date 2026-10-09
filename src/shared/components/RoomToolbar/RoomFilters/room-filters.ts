import { listOf, matchOf, oneOf, PUBLIC_ID } from '@/lib/routes/search-params.ts';
import {
  readCreatedFilter,
  readFollowUpFilter,
  toDateRange,
} from '@/shared/api/clinic/clinic-list-filters.ts';

/**
 * The Filters popover's model of a room's filters (KICKOFF §3.5): which URL
 * keys it edits and how, read from and written to the search the room's own
 * `validateSearch` parses with the shared readers (`lib/routes/search-params`,
 * `clinic-list-filters`). The URL form is theirs: an options filter is a list
 * (a single pick, a plain value), a people filter a list of membership ids (one, a plain
 * value) and a date filter its preset or a custom range `YYYY-MM-DD..YYYY-MM-DD`.
 */

/** A date section of the popover: "Created" or "Follow-up date" (S:1541–1542). */
export type RoomDateFilterKind = 'created' | 'followUp';

/** One filter of a room's list. */
export type RoomFilterField =
  /** Chips: one per value — several at once, or one (`single`: tap again to clear). */
  | {
      readonly kind: 'options';
      readonly values: readonly string[];
      readonly single?: boolean;
    }
  /**
   * A date section: its presets, or a custom range — less the presets the room's API cannot
   * filter by (`without`).
   */
  | {
      readonly kind: 'date';
      readonly presets: RoomDateFilterKind;
      readonly without?: readonly string[];
    }
  /**
   * Team members by membership id (`mem_…`), any number — or one (`single`) — a picker that
   * expands a searchable list (the Leads "Team · assigned or involved", H:1711–1718).
   */
  | { readonly kind: 'people'; readonly single?: boolean };

/**
 * An "automatic" options section — the values a list happens to hold (a
 * manufacturer, a category, a payment mode) — shows only while it has 2 to 10
 * distinct values (`_patterns.md` Filters; KICKOFF §6.7–§6.9): one value
 * filters nothing, and more than ten is a picker's job.
 */
export function showsAutomaticSection(distinctValues: number): boolean {
  return distinctValues >= 2 && distinctValues <= 10;
}

/** A room's filters by URL key, in the order the popover shows them. */
export type RoomFilterFields = Readonly<Record<string, RoomFilterField>>;

/**
 * Filter values by URL key — the applied set, the popover's pending set and
 * what a saved view keeps. A date filter holds one value: a preset or a range.
 */
export type RoomFilterValues = Readonly<Record<string, readonly string[]>>;

/** One field's value as the URL holds it, `undefined` when it is unset or invalid. */
function paramOf(field: RoomFilterField, raw: unknown): string | string[] | undefined {
  if (field.kind === 'date') {
    const value =
      field.presets === 'created' ? readCreatedFilter(raw) : readFollowUpFilter(raw);
    return value && field.without?.includes(value) ? undefined : value;
  }
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (field.kind === 'people') {
    return field.single
      ? matchOf(PUBLIC_ID, first)
      : listOf(raw, (entry) => PUBLIC_ID.test(entry));
  }
  if (field.single) return oneOf(field.values, first);
  return listOf(raw, (entry) => field.values.includes(entry));
}

/** Whether a field's URL value is a list (many options or people), not one value. */
const isListField = (field: RoomFilterField) => field.kind !== 'date' && !field.single;

/** The filter values a search applies — the room's own keys, read with the shared readers. */
export function roomFilterValues(
  fields: RoomFilterFields,
  search: Readonly<Record<string, unknown>>,
): RoomFilterValues {
  const values: Record<string, readonly string[]> = {};
  for (const [key, field] of Object.entries(fields)) {
    const param = paramOf(field, search[key]);
    if (param !== undefined) values[key] = typeof param === 'string' ? [param] : param;
  }
  return values;
}

/**
 * The search patch that applies `values`: every key the room's filters own,
 * `undefined` for each one cleared so the URL drops it. A value the readers
 * reject — a view saved before a value was retired, a range with no ends — is
 * dropped too.
 */
export function roomFilterSearchPatch(
  fields: RoomFilterFields,
  values: RoomFilterValues,
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => {
      const picked = values[key];
      return [key, paramOf(field, isListField(field) ? picked : picked?.[0])];
    }),
  );
}

/**
 * How many filters are on (H:4170): one per picked option or person, one per
 * date section set — the Filters button's count.
 */
export function countRoomFilters(
  fields: RoomFilterFields,
  values: RoomFilterValues,
): number {
  return Object.entries(fields).reduce((count, [key, field]) => {
    const picked = values[key]?.length ?? 0;
    if (field.kind === 'date') return count + (picked > 0 ? 1 : 0);
    return count + picked;
  }, 0);
}

/** `values` with `key` emptied — a section's "Clear". */
export function clearRoomFilter(values: RoomFilterValues, key: string): RoomFilterValues {
  return withValues(values, key, []);
}

/** `values` with `key` set to `next` — in place when it was there, gone when empty. */
function withValues(
  values: RoomFilterValues,
  key: string,
  next: readonly string[],
): RoomFilterValues {
  if (next.length > 0) return { ...values, [key]: next };
  return Object.fromEntries(Object.entries(values).filter(([entry]) => entry !== key));
}

/**
 * Pick or unpick one option chip: any number stay picked, a `single` filter
 * keeps one, and tapping the picked chip again clears it.
 */
export function toggleRoomFilterOption(
  values: RoomFilterValues,
  key: string,
  value: string,
  single = false,
): RoomFilterValues {
  const picked = values[key] ?? [];
  if (picked.includes(value)) {
    return withValues(
      values,
      key,
      picked.filter((entry) => entry !== value),
    );
  }
  return withValues(values, key, single ? [value] : [...picked, value]);
}

/** Set a date section to a preset or a range — `undefined` is "Any". */
export function setRoomDateFilter(
  values: RoomFilterValues,
  key: string,
  value: string | undefined,
): RoomFilterValues {
  return withValues(values, key, value === undefined ? [] : [value]);
}

/** Whether a date filter value is a custom range (`from..to`, either end open). */
export function isDateRange(value: string | undefined): value is string {
  return value?.includes('..') ?? false;
}

/** A custom range's two ends — `null` for an open one — as the pickers show them. */
export function dateRangeEnds(value: string): { from: string | null; to: string | null } {
  const [from = '', to = ''] = value.split('..');
  return { from: from || null, to: to || null };
}

/** A custom range with one end moved (`null` opens it). */
export function withDateRangeEnd(
  value: string,
  end: 'from' | 'to',
  date: string | null,
): string {
  const ends = dateRangeEnds(value);
  return end === 'from' ? toDateRange(date, ends.to) : toDateRange(ends.from, date);
}
