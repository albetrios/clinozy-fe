import type { RowData } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useEffect, useEffectEvent } from 'react';

import type { TableRow } from './data-table-layout.ts';

/** Lists longer than this render only the visible rows (H:4117). */
export const VIRTUALIZE_ABOVE = 60;
/** Row height before a row is measured (H:4117). */
export const ROW_HEIGHT = 52;
/** Rows rendered beyond the visible ones (H:4117). */
const OVERSCAN = 10;

interface TableWindowOptions<TData extends RowData> {
  rows: readonly TableRow<TData>[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** On the last 80px of the list: the next page loads as it scrolls in. */
  sentinelRef: RefObject<HTMLDivElement | null>;
  virtualizeAbove: number;
  rowHeight: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (() => void) | undefined;
}

/** The rows to render now, and what the list needs around them. */
export interface TableWindow<TData extends RowData> {
  virtualizing: boolean;
  /** The rows to render, with their index in the full list. */
  windowed: readonly { row: TableRow<TData>; index: number }[];
  /** Space above and below the rendered rows (px). */
  padTop: number;
  padBottom: number;
  /** Attach to each rendered row while virtualising (it measures the row). */
  measureRow: ((node: HTMLDivElement | null) => void) | undefined;
  scrollToIndex: (index: number) => void;
}

/**
 * The list's length (KICKOFF §3.5 Length; D7): above `virtualizeAbove` rows
 * only the visible rows plus 10 of overscan render, measured as they mount
 * (52px until then); the next cursor page loads when the end of the list
 * scrolls into view.
 */
export function useTableWindow<TData extends RowData>({
  rows,
  scrollerRef,
  sentinelRef,
  virtualizeAbove,
  rowHeight,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: TableWindowOptions<TData>): TableWindow<TData> {
  const virtualizing = rows.length > virtualizeAbove;
  // The virtualizer re-renders this component as it scrolls; its stable
  // `measureElement` and `scrollToIndex` are all that leave the component.
  // eslint-disable-next-line react-hooks/incompatible-library -- see above
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => rowHeight,
    // An unlaid-out row reads 0 tall; keep the estimate instead.
    measureElement: (element) => element.getBoundingClientRect().height || rowHeight,
    // The first render draws a window before the scroller is measured.
    initialRect: { width: 0, height: rowHeight * OVERSCAN },
    overscan: OVERSCAN,
    enabled: virtualizing,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  const items = virtualizing ? virtualizer.getVirtualItems() : [];
  let windowed = rows.map((row, index) => ({ row, index }));
  if (virtualizing) {
    // A scroller with no height yet (hidden, not laid out) gets a first window
    // rather than nothing.
    windowed =
      items.length > 0
        ? items.flatMap((item) => {
            const row = rows[item.index];
            return row ? [{ row, index: item.index }] : [];
          })
        : windowed.slice(0, OVERSCAN * 2);
  }
  const last = items.at(-1);

  const loadMore = useEffectEvent(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage?.();
  });
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!(sentinel && hasNextPage) || isFetchingNextPage) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    // A fresh observer each time a page lands (isFetchingNextPage → false): its
    // first report re-checks a list that still does not fill the scroller.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, sentinelRef]);

  return {
    virtualizing,
    windowed,
    padTop: items[0]?.start ?? 0,
    padBottom: last ? Math.max(0, virtualizer.getTotalSize() - last.end) : 0,
    measureRow: virtualizing ? virtualizer.measureElement : undefined,
    scrollToIndex: (index) => {
      if (virtualizing) virtualizer.scrollToIndex(index, { align: 'auto' });
    },
  };
}
