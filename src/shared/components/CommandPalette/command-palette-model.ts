import { type KeyboardEvent, useCallback, useState } from 'react';

import type { AppIcon } from '@/shared/icons/index.ts';

/** One row of the command menu. */
export interface CommandRow {
  /** cmdk's value — unique across the menu; the active row follows it. */
  value: string;
  label: string;
  /** The muted text at the row's inline end ("Leads", "#3508 · •••• 3212"). */
  sub?: string;
  icon: AppIcon;
  onSelect: () => void;
  testId?: string;
  /** Extra terms the query matches — locale-independent, unlike the label. */
  keywords?: readonly string[];
  destructive?: boolean;
  /** The icon points along the reading direction (Log out's chevron): mirrored under RTL. */
  mirrored?: boolean;
}

/** One headed group of rows. */
export interface CommandRowGroup {
  id: string;
  heading: string;
  rows: CommandRow[];
}

/**
 * Whether a row answers the query the way the design's menu matches (H:4601–
 * 4602): its label or one of its keywords contains it, in any case. An empty
 * query matches every row. cmdk's own fuzzy filter is off — the groups keep
 * the design's order and caps.
 */
export function matchesCommandQuery(
  label: string,
  keywords: readonly string[] | undefined,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    label.toLowerCase().includes(needle) ||
    (keywords ?? []).some((keyword) => keyword.toLowerCase().includes(needle))
  );
}

const MOVE_KEYS: ReadonlySet<string> = new Set([
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
  'PageDown',
  'PageUp',
]);
/** cmdk's vim bindings: Ctrl N / J next, Ctrl P / K previous. */
const VIM_MOVE_KEYS: ReadonlySet<string> = new Set(['n', 'j', 'p', 'k']);

/** Whether a key press moves the active row. */
export function isSelectionMove(event: Pick<KeyboardEvent, 'key' | 'ctrlKey'>): boolean {
  return (
    MOVE_KEYS.has(event.key) ||
    (event.ctrlKey && VIM_MOVE_KEYS.has(event.key.toLowerCase()))
  );
}

/** The command menu's active row, as cmdk's controlled value. */
export interface CommandSelection {
  value: string;
  onValueChange: (value: string) => void;
  /** The user moved the active row (keys or pointer); it stays theirs until the query changes. */
  markMoved: () => void;
}

/**
 * The design's active row (H:4538, H:4609): the first row on open and after
 * every keystroke — including when the search's rows arrive a beat later above
 * whatever cmdk picked — until the user moves it with the keys or the pointer.
 *
 * @param firstValue The first row the menu knows synchronously (its clinic
 *   groups lead the list); undefined lets cmdk's own pick stand.
 */
export function useCommandSelection(
  query: string,
  firstValue: string | undefined,
): CommandSelection {
  const [movedAt, setMovedAt] = useState<string | null>(null);
  const [picked, setPicked] = useState('');
  const pinned = movedAt !== query;
  const markMoved = useCallback(() => setMovedAt(query), [query]);
  return {
    value: pinned && firstValue ? firstValue : picked,
    onValueChange: setPicked,
    markMoved,
  };
}
