import { type RefObject, useEffect, useEffectEvent } from 'react';

/** The paging state a list's sentinel reads (a `useCursorList` result fits). */
export interface LoadMorePaging {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (() => void) | undefined;
}

/**
 * Infinite scroll over cursor pages (KICKOFF §3.5 Length; D7): the next page
 * loads when the sentinel — an element after the list's last row — scrolls
 * into view. A fresh observer each time a page lands (`isFetchingNextPage` →
 * false) re-checks a list that still does not fill its scroller. The shared
 * table and the Tasks list page this way.
 */
export function useLoadMoreSentinel(
  sentinelRef: RefObject<HTMLElement | null>,
  { hasNextPage, isFetchingNextPage, fetchNextPage }: LoadMorePaging,
): void {
  const loadMore = useEffectEvent(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage?.();
  });
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!(sentinel && hasNextPage) || isFetchingNextPage) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, sentinelRef]);
}
