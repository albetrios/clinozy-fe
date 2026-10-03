import { useCallback, useState } from 'react';

interface StackedDrawerState {
  open: boolean;
  /** What the user had typed in the picker that opened the child. */
  query: string;
}

const CLOSED: StackedDrawerState = { open: false, query: '' };

/** What {@link useStackedDrawer} hands the parent screen. */
export interface StackedDrawer<TRecord> {
  /** The child `RecordDrawer`'s `open` (render it with `stacked`, so it reads "Back"). */
  isOpen: boolean;
  /** The picker query the child opened with — prefill its name field. */
  query: string;
  /** Open the child on top of the parent, e.g. from a picker's "＋ New … · “q”". */
  open: (query?: string) => void;
  /** Close only the child (its Back, ×, backdrop or Esc). */
  close: () => void;
  /** The child saved: close it and hand the new record to the parent field. */
  complete: (record: TRecord) => void;
}

/**
 * A child record drawer stacked on a parent (`_patterns.md:37`, S:116): component
 * state, not a route. The parent stays open underneath; the child's save closes
 * only the child and passes the created record to `onCreated`, which selects it
 * in the parent's field.
 */
export function useStackedDrawer<TRecord>(
  onCreated: (record: TRecord) => void,
): StackedDrawer<TRecord> {
  const [state, setState] = useState<StackedDrawerState>(CLOSED);

  const open = useCallback((query = '') => setState({ open: true, query }), []);
  const close = useCallback(() => setState(CLOSED), []);
  const complete = useCallback(
    (record: TRecord) => {
      setState(CLOSED);
      onCreated(record);
    },
    [onCreated],
  );

  return { isOpen: state.open, query: state.query, open, close, complete };
}
