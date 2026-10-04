import { useVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useEffect, useEffectEvent } from 'react';

/** Lists longer than this render only the visible rows (H:4117). */
export const VIRTUALIZE_ABOVE = 60;
/** Row height before a row is measured (H:4117). */
export const ROW_HEIGHT = 52;
/** Rows rendered beyond the visible ones (H:4117). */
const OVERSCAN = 10;

interface TableWindowOptions<TItem extends { id: string }> {
  /** The body's entries in order — rows, and group headers when the table groups. */
  items: readonly TItem[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** On the last 80px of the list: the next page loads as it scrolls in. */
  sentinelRef: RefObject<HTMLDivElement | null>;
  virtualizeAbove: number;
  rowHeight: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (() => void) | undefined;
}

/** The entries to render now, and what the list needs around them. */
export interface TableWindow<TItem extends { id: string }> {
  virtualizing: boolean;
  /** The entries to render, with their index in the full list. */
  windowed: readonly { item: TItem; index: number }[];
  /** Space above and below the rendered entries (px). */
  padTop: number;
  padBottom: number;
  /** The first entry at the top of the scroller while virtualising (a pinned group header reads it). */
  firstVisibleIndex: number | null;
  /** Attach to each rendered entry while virtualising (it measures it). */
  measureRow: ((node: HTMLDivElement | null) => void) | undefined;
  scrollToIndex: (index: number) => void;
}

/**
 * The list's length (KICKOFF §3.5 Length; D7): above `virtualizeAbove` entries
 * only the visible ones plus 10 of overscan render, measured as they mount
 * (52px until then); the next cursor page loads when the end of the list
 * scrolls into view.
 */
export function useTableWindow<TItem extends { id: string }>({
  items,
  scrollerRef,
  sentinelRef,
  virtualizeAbove,
  rowHeight,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: TableWindowOptions<TItem>): TableWindow<TItem> {
  const virtualizing = items.length > virtualizeAbove;
  // The virtualizer re-renders this component as it scrolls; its stable
  // `measureElement` and `scrollToIndex` are all that leave the component.
  // eslint-disable-next-line react-hooks/incompatible-library -- see above
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: items.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => rowHeight,
    // An unlaid-out row reads 0 tall; keep the estimate instead.
    measureElement: (element) => element.getBoundingClientRect().height || rowHeight,
    // The first render draws a window before the scroller is measured.
    initialRect: { width: 0, height: rowHeight * OVERSCAN },
    overscan: OVERSCAN,
    enabled: virtualizing,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  const virtualItems = virtualizing ? virtualizer.getVirtualItems() : [];
  let windowed = items.map((item, index) => ({ item, index }));
  if (virtualizing) {
    // A scroller with no height yet (hidden, not laid out) gets a first window
    // rather than nothing.
    windowed =
      virtualItems.length > 0
        ? virtualItems.flatMap((virtual) => {
            const item = items[virtual.index];
            return item ? [{ item, index: virtual.index }] : [];
          })
        : windowed.slice(0, OVERSCAN * 2);
  }
  const last = virtualItems.at(-1);
  const offset = virtualizer.scrollOffset ?? 0;
  const firstVisible = virtualItems.find((virtual) => virtual.end > offset);

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
    padTop: virtualItems[0]?.start ?? 0,
    padBottom: last ? Math.max(0, virtualizer.getTotalSize() - last.end) : 0,
    firstVisibleIndex: virtualizing
      ? (firstVisible?.index ?? windowed[0]?.index ?? null)
      : null,
    measureRow: virtualizing ? virtualizer.measureElement : undefined,
    scrollToIndex: (index) => {
      if (virtualizing) virtualizer.scrollToIndex(index, { align: 'auto' });
    },
  };
}
