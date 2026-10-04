import { type KeyboardEvent, useState } from 'react';

import type { QuickLineItem, QuickLineProps } from './quick-line.types.ts';

/** One row of the matches list: an item, or the "add as typed" row. */
export type QuickLineRow<TItem> =
  { kind: 'item'; item: QuickLineItem<TItem> } | { kind: 'typed'; name: string };

/**
 * The quick line's state (H:3789–3806): the typed text and what the grammar
 * reads from it, whether the list is open, the active row, Browse — and the
 * keys: ↑ / ↓ move (wrapping), ↵ adds the active row, and adding clears the
 * line and keeps the list open for the next item.
 */
export function useQuickLineState<TItem, TValues>(
  {
    parse,
    matches,
    typedName,
    onPick,
    onCreate,
  }: Pick<
    QuickLineProps<TItem, TValues>,
    'parse' | 'matches' | 'typedName' | 'onPick' | 'onCreate'
  >,
  listId: string,
) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [browsing, setBrowsing] = useState(false);

  const parsed = parse(text);
  const searching = parsed.words.length > 0;
  const typed = onCreate && typedName ? typedName(parsed.words) : null;
  const found = searching || open ? matches(parsed.words) : [];
  const rows: QuickLineRow<TItem>[] = found.map((item) => ({ kind: 'item', item }));
  if (typed) rows.push({ kind: 'typed', name: typed });
  const current = Math.min(active, Math.max(0, rows.length - 1));

  const add = (row: QuickLineRow<TItem> | undefined) => {
    if (!row) return;
    if (row.kind === 'typed') onCreate?.(row.name, parsed.values);
    else onPick(row.item.data, parsed.values);
    setText('');
    setActive(0);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = rows.length;
    if (event.key === 'Enter') {
      event.preventDefault();
      add(rows[current]);
      return;
    }
    if (!count || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    setOpen(true);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    setActive((current + step + count) % count);
  };

  return {
    text,
    parsed,
    rows,
    current,
    /** Nothing is typed: the rows are suggestions. */
    suggesting: !searching,
    showList: open && rows.length > 0,
    showNone: open && searching && rows.length === 0,
    browsing,
    setBrowsing,
    setOpen,
    setActive,
    optionId: (index: number) => `${listId}-${index}`,
    add,
    onKeyDown,
    type: (next: string) => {
      setText(next);
      setActive(0);
      setOpen(true);
    },
    /** Esc: clears a typed line and says so; an empty line is left to close the list. */
    clear: () => {
      if (!text) return false;
      setText('');
      setActive(0);
      return true;
    },
    /** A frequent chip adds its item with nothing typed. */
    pickFrequent: (item: QuickLineItem<TItem>) => onPick(item.data, parse('').values),
  };
}
