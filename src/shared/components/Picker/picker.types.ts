import type { QueryKey } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { ListPage } from '@/shared/api/fetch-list-page.ts';
import type { AppIcon } from '@/shared/icons/index.ts';

/** Trigger heights: 32px (`sm`), 36px (`md`), 44px (`lg`). */
export type PickerSize = 'sm' | 'md' | 'lg';

/**
 * What leads an option row. `dot` (the default) is a 10px tone dot with a 3px
 * halo; `avatar` a 26px initials disc (with the green "P" badge for patients);
 * `icon` a 24px tone tile; `pill` draws the label itself as a tone pill; `none`
 * leaves the slot empty.
 */
export type PickerLeading =
  | { kind: 'dot' }
  | { kind: 'avatar'; initials: string; patient?: boolean }
  | { kind: 'icon'; icon: AppIcon }
  | { kind: 'pill'; icon?: AppIcon }
  | { kind: 'none' };

/** One option. `key` is what `onChange` reports and what Recent stores. */
export interface PickerOption<T = unknown> {
  /** Stable, unique id — an id, never a name or phone (Recent stores it). */
  key: string;
  label: string;
  /** Secondary line (11.5px): beside the label, wrapping under it when narrow. */
  sub?: string;
  /** Trailing value at the inline end (11.5px, tabular). */
  meta?: string;
  /** Group header; consecutive options with the same group share one. */
  group?: string;
  /** Tone of the group header's square (defaults to the group name's hash). */
  groupTone?: Tone;
  /** The option's tone; without one the label hashes onto six tones (H:3875). */
  tone?: Tone;
  leading?: PickerLeading;
  disabled?: boolean;
  /** Painted destructive, after a separator. */
  destructive?: boolean;
  /** Extra words the local search matches. */
  keywords?: readonly string[];
  /** The record behind the option, handed back by `onChange`. */
  data?: T;
}

/** Loads one page of remote options; the server filters by `query`. */
export type PickerLoader<T> = (
  query: string,
  cursor: string | undefined,
) => Promise<ListPage<PickerOption<T>>>;

/** Replaces the local search (e.g. the date picker's typed dates). */
export type PickerFilter<T> = (
  options: readonly PickerOption<T>[],
  query: string,
) => PickerOption<T>[];

/** What a custom trigger renders from. */
export interface PickerTriggerState<T> {
  open: boolean;
  selected: readonly PickerOption<T>[];
  placeholder: string;
}

/** Props both selection modes share. */
interface PickerBaseProps<T> {
  /** Static options, filtered locally. */
  options?: readonly PickerOption<T>[];
  /** Remote options, one page per call (server search, `shouldFilter={false}`). */
  loadOptions?: PickerLoader<T>;
  /** Query-key prefix for `loadOptions`; the search text is appended. */
  loadOptionsKey?: QueryKey;
  /** Options to show for the current value before its page has loaded. */
  selectedOptions?: readonly PickerOption<T>[];
  /** The field's name: the trigger's accessible name, the panel's and the list's. */
  label?: string;
  /** Trigger text with nothing picked (default "Select…"). */
  placeholder?: string;
  /** Search placeholder (default "Search <label>"). */
  searchPlaceholder?: string;
  /** Show the search row; by default for remote data, creatable fields and lists of more than 7. */
  searchable?: boolean;
  /** Text for a list with nothing in it (default "Nothing to pick yet"). */
  emptyText?: string;
  size?: PickerSize;
  /** The panel's minimum width in px (default 240). */
  minWidth?: PickerMinWidthValue;
  /** The panel's maximum height in px (default 340). */
  maxHeight?: PickerMaxHeightValue;
  /** Panel alignment to the trigger (default `start`). */
  align?: 'start' | 'end';
  /** Show a clear × while something is picked. */
  clearable?: boolean;
  disabled?: boolean;
  /** Marks the trigger `aria-invalid` (form errors). */
  invalid?: boolean;
  /** The trigger's id, for an external `<label htmlFor>`. */
  id?: string;
  'aria-describedby'?: string;
  /** `<room>:<field>` — turns on the Recent group (single-select lists of more than 7). */
  recentKey?: string;
  /** Action menu: no check column, no Recent, no search by default. */
  menu?: boolean;
  /** Offers a "Create “<query>”" row for an unmatched search. */
  onCreate?: (query: string) => void;
  /** Replaces "Create" in the create row (e.g. "Add supplier"). */
  createLabel?: string;
  /** Footer action that opens the record's full form, stacked on top. */
  onCreateFull?: (query: string) => void;
  /** Footer label (default "New <label>"). */
  createFullLabel?: string;
  /** Create on close when the search matches nothing (medicine lines, H:4807). */
  autoCreate?: boolean;
  /** Replaces the local search. */
  filter?: PickerFilter<T>;
  /** Chips a multi-select trigger shows before "+N" (default 3). */
  maxChips?: number;
  /** Replaces the default trigger; must render a focusable button that accepts props. */
  renderTrigger?: (state: PickerTriggerState<T>) => ReactElement;
  /** Notified when the list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Base test id (default `picker`); the panel, search and options derive from it. */
  testId?: string;
  /** Classes for the field wrapper. */
  className?: string;
}

/** A single-select picker: picking closes the list. */
export interface PickerSingleProps<T> extends PickerBaseProps<T> {
  multiple?: false;
  value: string | null;
  onChange: (key: string | null, option: PickerOption<T> | null) => void;
}

/** A multi-select picker: the list stays open while picking. */
export interface PickerMultipleProps<T> extends PickerBaseProps<T> {
  multiple: true;
  value: readonly string[];
  onChange: (keys: string[], options: PickerOption<T>[]) => void;
}

/** {@link Picker} props: single (`value: string | null`) or multiple (`value: string[]`). */
export type PickerProps<T = unknown> = PickerSingleProps<T> | PickerMultipleProps<T>;

/** Panel minimum widths the design uses (px). */
export type PickerMinWidthValue =
  180 | 200 | 210 | 220 | 230 | 240 | 250 | 260 | 280 | 290 | 300 | 320 | 340 | 360;

/** Panel maximum heights the design uses (px). */
export type PickerMaxHeightValue = 300 | 320 | 340;
