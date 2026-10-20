import type { TFunction } from 'i18next';

import {
  PICKER_KEYS,
  PICKER_PAGE_SIZE,
  PICKER_RECENT_ROWS,
  PICKER_SEARCH_THRESHOLD,
} from './picker.constants.ts';
import type { PickerOption, PickerProps, PickerSize } from './picker.types.ts';

/** `single` draws a check, `multiple` a checkbox, `menu` neither (and no Recent). */
export type PickerMode = 'single' | 'multiple' | 'menu';

/** The mode a picker's props ask for. */
export function pickerMode<T>(props: PickerProps<T>): PickerMode {
  if (props.menu) return 'menu';
  return props.multiple ? 'multiple' : 'single';
}

/** The keys picked right now, whichever mode. */
export function selectedKeysOf<T>(props: PickerProps<T>): readonly string[] {
  if (props.multiple) return props.value;
  return props.value === null ? [] : [props.value];
}

/**
 * Whether the search row shows (H:3943): remote data always, creatable fields,
 * and static lists of more than 7 — never a menu, unless the caller decides.
 */
export function isSearchable<T>(props: PickerProps<T>, remote: boolean): boolean {
  if (props.searchable !== undefined) return props.searchable;
  if (props.menu) return false;
  return (
    remote ||
    props.onCreate !== undefined ||
    (props.options?.length ?? 0) > PICKER_SEARCH_THRESHOLD
  );
}

/** Some option's label is exactly the typed text (then nothing is offered to create). */
export function hasExactLabel<T>(
  options: readonly PickerOption<T>[],
  trimmedQuery: string,
): boolean {
  if (!trimmedQuery) return false;
  const typed = trimmedQuery.toLowerCase();
  return options.some((option) => option.label.toLowerCase() === typed);
}

/** Static single-select lists open on the page that holds the current value. */
export function openingPages<T>(props: PickerProps<T>): number {
  if (props.multiple || props.value === null || !props.options) return 1;
  const value = props.value;
  const index = props.options.findIndex((option) => option.key === value);
  return Math.max(1, Math.ceil((index + 1 + PICKER_RECENT_ROWS) / PICKER_PAGE_SIZE));
}

/**
 * An option as a `plain` list draws it (H:3917, H:3958, H:3961): its row and
 * group square in `stone`, and no tone dot — an avatar, icon or pill stays.
 */
export function plainOption<T>(option: PickerOption<T>): PickerOption<T> {
  const kind = option.leading?.kind ?? 'dot';
  return {
    ...option,
    tone: 'stone',
    groupTone: 'stone',
    leading: kind === 'dot' ? { kind: 'none' } : option.leading,
  };
}

/** `keys` with `key` toggled (added at the end, or removed). */
export function toggleKey(keys: readonly string[], key: string): string[] {
  return keys.includes(key)
    ? keys.filter((existing) => existing !== key)
    : [...keys, key];
}

/** Where the trigger's text starts. */
export function triggerInset(
  size: PickerSize,
  avatar: boolean,
): 'default' | 'compact' | 'avatar' {
  if (avatar) return 'avatar';
  return size === 'sm' ? 'compact' : 'default';
}

/** The copy one picker shows, from its props and the current picks. */
export interface PickerCopy {
  placeholder: string;
  searchPlaceholder: string;
  /** The list's and the surface's accessible name. */
  listLabel: string;
  /**
   * The trigger's accessible name and title: "<label> · <picks>", or "<label> · <placeholder>"
   * while nothing is picked — the name holds the words the trigger shows (WCAG 2.5.3).
   */
  triggerLabel: string | undefined;
  /** The footer action's text without the query ("New supplier"). */
  createFullLabel: string;
}

/**
 * The picker's copy. A default that embeds the label lower-cases it the
 * locale's way ("Search doctor"); pass `searchPlaceholder` /
 * `createFullLabel` where that reads wrong (German nouns).
 */
export function pickerCopy<T>(
  t: TFunction,
  language: string,
  props: PickerProps<T>,
  selected: readonly PickerOption<T>[],
): PickerCopy {
  const label = props.label ?? '';
  const lower = label.toLocaleLowerCase(language);
  const value = selected.map((option) => option.label).join(', ');
  const placeholder = props.placeholder ?? t(PICKER_KEYS.placeholder);
  const triggerLabel = label
    ? t(PICKER_KEYS.triggerLabel, { label, value: value || placeholder })
    : undefined;
  return {
    placeholder,
    searchPlaceholder:
      props.searchPlaceholder ??
      (label ? t(PICKER_KEYS.search, { label: lower }) : t(PICKER_KEYS.searchDefault)),
    listLabel: label || t(PICKER_KEYS.options),
    triggerLabel,
    createFullLabel: props.createFullLabel ?? t(PICKER_KEYS.createFull, { label: lower }),
  };
}

/**
 * The empty states (H:3967): with no search, "Nothing to pick yet" (or the
 * field's text); with one, "No results for “<query>”" and a hint — names,
 * phones and ids for remote search, spelling otherwise.
 */
export function pickerEmptyState(
  t: TFunction,
  answeredQuery: string,
  remote: boolean,
  emptyText: string | undefined,
): { title: string; hint?: string } {
  if (!answeredQuery) return { title: emptyText ?? t(PICKER_KEYS.empty) };
  return {
    title: t(PICKER_KEYS.noResults, { query: answeredQuery }),
    hint: t(remote ? PICKER_KEYS.noResultsRemoteHint : PICKER_KEYS.noResultsHint),
  };
}
