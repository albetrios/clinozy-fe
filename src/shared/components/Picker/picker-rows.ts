import type { Tone } from '@/shared/api/app/app-schema.ts';
import { toneForLabel } from '@/shared/app/app-tone-label.ts';

import type { PickerFilter, PickerOption } from './picker.types.ts';

/** A label split around the search match (drawn on `bg-highlight`). */
export interface PickerMatch {
  before: string;
  hit: string;
  after: string;
}

/** One option in the rendered list. */
export interface PickerOptionRow<T> {
  kind: 'option';
  /** The cmdk item value — unique even when an option shows in Recent and in its group. */
  value: string;
  option: PickerOption<T>;
  tone: Tone;
  match: PickerMatch | null;
}

/** The line that sets destructive options apart. */
interface PickerSeparatorRow {
  kind: 'separator';
  id: string;
}

/** A run of rows under one group header (or none). */
export interface PickerSection<T> {
  id: string;
  heading?: string;
  tone: Tone;
  items: (PickerOptionRow<T> | PickerSeparatorRow)[];
}

/** The list a picker renders, plus what paging needs. */
export interface PickerRows<T> {
  sections: PickerSection<T>[];
  /** Option rows in render order. */
  optionRows: PickerOptionRow<T>[];
  /** Rows available before paging cut the list. */
  total: number;
  /** More rows than the current page shows. */
  hasMore: boolean;
}

/** Inputs to {@link buildPickerRows}. */
export interface BuildPickerRowsInput<T> {
  options: readonly PickerOption<T>[];
  query: string;
  /** Replaces the local search. */
  filter?: PickerFilter<T>;
  /** The options already match the query (a server search): no local filter or sort. */
  serverFiltered?: boolean;
  /** Recent picks, newest first. */
  recentKeys: readonly string[];
  /** Whether this list shows the Recent group at all. */
  recentEnabled: boolean;
  /** How many rows to show (static paging); `Infinity` for all. */
  limit: number;
  /** Translated "Recent" and "All" headers. */
  labels: { recent: string; all: string };
}

/** The search term: trimmed and lower-cased. */
function pickerSearchTerm(query: string): string {
  return query.trim().toLowerCase();
}

/** Split `label` around the first case-insensitive occurrence of `term`. */
export function matchLabel(label: string, term: string): PickerMatch | null {
  if (!term) return null;
  const lower = label.toLowerCase();
  // A case mapping that changes the length (e.g. "İ") would shift the indexes.
  if (lower.length !== label.length) return null;
  const at = lower.indexOf(term);
  if (at < 0) return null;
  return {
    before: label.slice(0, at),
    hit: label.slice(at, at + term.length),
    after: label.slice(at + term.length),
  };
}

function searchText<T>(option: PickerOption<T>): string {
  return [option.label, option.sub, option.meta, option.group, ...(option.keywords ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * The local search (H:3949): keep options whose label, sub, meta, group or
 * keywords contain the term; options whose label starts with it come first,
 * otherwise the original order holds.
 */
export function filterPickerOptions<T>(
  options: readonly PickerOption<T>[],
  query: string,
): PickerOption<T>[] {
  const term = pickerSearchTerm(query);
  if (!term) return [...options];
  const rank = (option: PickerOption<T>) =>
    option.label.toLowerCase().startsWith(term) ? 0 : 1;
  return options
    .filter((option) => searchText(option).includes(term))
    .sort((a, b) => rank(a) - rank(b));
}

interface Entry<T> {
  option: PickerOption<T>;
  group: string | undefined;
  groupTone: Tone | undefined;
  section: 'recent' | 'all';
}

function withRecent<T>(
  matched: readonly PickerOption<T>[],
  input: BuildPickerRowsInput<T>,
  term: string,
): Entry<T>[] {
  const plain = (option: PickerOption<T>): Entry<T> => ({
    option,
    group: option.group,
    groupTone: option.groupTone,
    section: 'all',
  });
  if (!input.recentEnabled || term || input.recentKeys.length === 0) {
    return matched.map(plain);
  }
  const recent = input.recentKeys
    .map((key) => input.options.find((option) => option.key === key && !option.disabled))
    .filter((option): option is PickerOption<T> => option !== undefined);
  if (recent.length === 0) return matched.map(plain);
  return [
    ...recent.map((option): Entry<T> => ({
      option,
      group: input.labels.recent,
      groupTone: 'stone',
      section: 'recent',
    })),
    ...matched.map((option): Entry<T> =>
      option.group
        ? plain(option)
        : { option, group: input.labels.all, groupTone: 'stone', section: 'all' },
    ),
  ];
}

/** The cmdk value of an option row — the section keeps Recent's copy distinct. */
export function pickerRowValue(section: 'recent' | 'all', key: string): string {
  return `${section}:${encodeURIComponent(key)}`;
}

function toRow<T>(entry: Entry<T>, term: string): PickerOptionRow<T> {
  const { option } = entry;
  return {
    kind: 'option',
    value: pickerRowValue(entry.section, option.key),
    option,
    tone: option.tone ?? toneForLabel(option.label),
    match: option.leading?.kind === 'pill' ? null : matchLabel(option.label, term),
  };
}

/**
 * The rows a picker renders (H:3946–3956): search (or the caller's filter),
 * the Recent group then "All" (single-select, no search), paging, group
 * headers for each run of one group, and a separator before destructive
 * options that follow ordinary ones.
 */
export function buildPickerRows<T>(input: BuildPickerRowsInput<T>): PickerRows<T> {
  const term = pickerSearchTerm(input.query);
  const matched = input.serverFiltered
    ? [...input.options]
    : (input.filter ?? filterPickerOptions)(input.options, input.query);
  const entries = withRecent(matched, input, term);
  const shown = entries.slice(0, input.limit);

  const sections: PickerSection<T>[] = [];
  const optionRows: PickerOptionRow<T>[] = [];
  let current: PickerSection<T> | undefined;
  let seenOrdinary = false;
  for (const entry of shown) {
    if (!current || current.heading !== entry.group) {
      current = {
        id: `${sections.length}:${entry.group ?? ''}`,
        heading: entry.group,
        tone: entry.groupTone ?? (entry.group ? toneForLabel(entry.group) : 'stone'),
        items: [],
      };
      sections.push(current);
    }
    if (entry.option.destructive && seenOrdinary) {
      current.items.push({ kind: 'separator', id: `separator:${optionRows.length}` });
      seenOrdinary = false;
    }
    if (!entry.option.destructive) seenOrdinary = true;
    const row = toRow(entry, term);
    current.items.push(row);
    optionRows.push(row);
  }

  return {
    sections,
    optionRows,
    total: entries.length,
    hasMore: entries.length > shown.length,
  };
}

/**
 * Type-ahead (lists without a search row): the index of the next label after
 * `from` that starts with `char`, wrapping round; `-1` when none does.
 */
export function nextLabelMatch(
  labels: readonly string[],
  from: number,
  char: string,
): number {
  const needle = char.toLowerCase();
  for (let step = 1; step <= labels.length; step += 1) {
    const index = (from + step + labels.length) % labels.length;
    if (labels[index]?.toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}
