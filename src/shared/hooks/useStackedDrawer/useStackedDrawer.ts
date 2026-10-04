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

/**
 * A picker's request for a stacked child (`_patterns.md:37`): which record
 * opens on top, named from the picker's text, and the field its save selects
 * the new record in. A room's requests add their own kind and prefill.
 */
export interface StackedRequest<TRecord> {
  query: string;
  onCreated: (record: TRecord) => void;
}

/** What {@link useStackedRequest} hands the page that hosts the drawers. */
export interface StackedRequests<TRequest, TRecord> {
  /** The child open on top, or `null`. */
  child: TRequest | null;
  /**
   * The last child asked for, open or not — the host keeps its drawer mounted
   * closed, so the sheet closes the way every drawer does.
   */
  last: TRequest | null;
  open: (request: TRequest) => void;
  /** Back, ×, the backdrop or Esc: only the child closes, nothing is selected. */
  close: () => void;
  /** The child saved: it closes and its record lands in the field that asked. */
  complete: (record: TRecord) => void;
}

/**
 * A room's stacked child driven by its pickers' requests, on
 * {@link useStackedDrawer}: one child at a time over the open drawer — the
 * request says which record it is — and its save hands the record to the
 * field that asked (Medical's makers, suppliers and MRs; Clinic stock's
 * vendors and items).
 */
export function useStackedRequest<
  TRequest extends StackedRequest<never>,
  TRecord,
>(): StackedRequests<TRequest, TRecord> {
  const [request, setRequest] = useState<TRequest | null>(null);
  const stacked = useStackedDrawer<TRecord>((record) => {
    if (request) (request.onCreated as (saved: TRecord) => void)(record);
  });
  return {
    child: stacked.isOpen ? request : null,
    last: request,
    open: (next) => {
      setRequest(next);
      stacked.open(next.query);
    },
    close: stacked.close,
    complete: stacked.complete,
  };
}
