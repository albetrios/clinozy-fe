import type { ReactNode, Ref } from 'react';

/** One thing the quick line can add: a match, a frequent chip or a Browse tile. */
export interface QuickLineItem<TItem> {
  /** Stable, unique key — the React key and the option id. */
  key: string;
  label: string;
  /** Secondary line: the last dosage, the stock, the category. */
  sub?: string;
  /** Trailing figure at the inline end: the MRP, the price. */
  meta?: string;
  /** The frequent chip's shorter label; the label by default. */
  chip?: string;
  /** The record behind the item, handed back on a pick. */
  data: TItem;
}

/**
 * A typed line as the host's grammar reads it: the words left to search
 * with, the pills showing what the shorthand set, and the values themselves.
 */
export interface QuickLineParse<TValues> {
  words: readonly string[];
  /** "0-0-1" · "After meal" · "10 days" · "×10" — shown while the line has text. */
  tags: readonly string[];
  values: TValues;
}

/** Browse (H:3797–3802): the host's groups, tiles and counts. */
export interface QuickLineBrowseConfig<TItem> {
  /** The group chips, in order; the first is open when Browse opens. */
  groups: readonly { id: string; label: string }[];
  /** A group's tiles narrowed by the line's words, all of them (Browse shows 60). */
  tiles: (group: string, words: readonly string[]) => readonly QuickLineItem<TItem>[];
  /** How many of an item the form holds — a tile with some shows its [− n +]. */
  count: (item: QuickLineItem<TItem>) => number;
  /** "2 added": how many different items the form holds. */
  added: number;
  /** A tile's tap or "+" (1), and its "−" (−1). */
  onStep: (item: QuickLineItem<TItem>, step: 1 | -1) => void;
  /** The inline "<item> not in the list" field and what adding a name does. */
  newItem?: { placeholder: string; onAdd: (name: string) => void };
}

/** Props of `QuickLine`. */
export interface QuickLineProps<TItem, TValues> {
  /** The 44px input's placeholder ("Type medicine, dose, timing · e.g. flu 0-0-1 af 10d"). */
  placeholder: string;
  /** The grammar's cheat sheet at the end of the matches footer ("od · bd · tds …"). */
  hint?: string;
  /** Read a typed line — the grammar is the host's. */
  parse: (text: string) => QuickLineParse<TValues>;
  /** The matches for the words; with none, the suggestions shown on focus. At most eight. */
  matches: (words: readonly string[]) => readonly QuickLineItem<TItem>[];
  /** The name to add "as typed" when the list lacks it, or null. */
  typedName?: (words: readonly string[]) => string | null;
  onPick: (item: TItem, values: TValues) => void;
  /** Adds a name the list does not have, with what the line set. */
  onCreate?: (name: string, values: TValues) => void;
  /** The chips under the line ("Often prescribed"): each adds its item. */
  frequent?: { label: string; items: readonly QuickLineItem<TItem>[] };
  /** The Browse button and its panel; none without it. */
  browse?: QuickLineBrowseConfig<TItem>;
  disabled?: boolean;
  /** The line's input — a host that focuses it on open (the Rx drawer's new prescription). */
  inputRef?: Ref<HTMLInputElement>;
  /**
   * The host focuses the line itself on open: that first focus keeps the suggestions closed
   * (they would cover the form before anything is typed); typing, or a later focus, opens them.
   */
  quietFirstFocus?: boolean;
  /** A control after Browse on the line's row — the Rx drawer's Pad toggle. */
  trailing?: ReactNode;
  /** Root test id; the parts derive theirs (`<testId>-input` …). */
  testId: string;
}
