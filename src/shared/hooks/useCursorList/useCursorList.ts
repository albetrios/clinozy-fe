import { keepPreviousData, type QueryKey, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import type { ListPage } from '@/shared/api/fetch-list-page.ts';

/**
 * Normalized result of a cursor-paginated list: the accumulated rows plus a
 * flat control surface. Hides `useInfiniteQuery`'s `data.pages` shape from
 * consumers so panels (and their tests) stay declarative. `TPage` is the page
 * as the fetcher returns it — a page that carries more than its rows (a total,
 * per-album counts) exposes those through {@link CursorListResult.firstPage}.
 */
export interface CursorListResult<T, TPage extends ListPage<T> = ListPage<T>> {
  /** All rows fetched so far, flattened across pages. */
  rows: T[];
  /**
   * The first page as the fetcher returned it — where a list's own counts ride
   * (`total`, `albumCounts`); `undefined` until it answers.
   */
  firstPage: TPage | undefined;
  isPending: boolean;
  /** The read has answered and its last fetch did not fail (`status === 'success'`). */
  isSuccess: boolean;
  isError: boolean;
  /** Any fetch in flight (initial load, refetch, or next page). */
  isFetching: boolean;
  /**
   * The rows on screen belong to the PREVIOUS params while the new ones load —
   * the cue for a subtle dim, never a skeleton swap. See {@link useCursorList}.
   */
  isRefreshing: boolean;
  /** Whether another page can be loaded. */
  hasNextPage: boolean;
  /** A `Load more` fetch is in flight. */
  isFetchingNextPage: boolean;
  /** Load the next keyset page (no-op when there is none). */
  fetchNextPage: () => void;
  /** Refetch from the first page (used by the error retry surface). */
  refetch: () => void;
}

/**
 * Wraps `useInfiniteQuery` for a clinozy-be keyset list: seeds `after` from the
 * previous page's forward cursor and exposes a {@link CursorListResult}. Keyset
 * pagination is forward-only, so this surfaces `fetchNextPage`/`hasNextPage`
 * (a `Load more` affordance) rather than jump-to-page controls.
 *
 * **Search and sort live in the query key, so every keystroke is a new query.**
 * Without `placeholderData` that query starts empty: `isPending` flips true, the
 * panel swaps its rows for a skeleton, then swaps back — the list blanks and
 * refills on each keystroke, and the page jumps as its height collapses (X-2).
 * `keepPreviousData` holds the previous rows on screen instead, and
 * `isRefreshing` marks them as belonging to the old params so the panel can dim
 * them. `isPending` then means what it says: the very first load.
 *
 * A failed fetch **toasts by default** (`meta.notifyOnError`); a list that
 * renders its own inline error surface opts out with `notifyOnError: false`
 * rather than failing silently by accident (X-3).
 *
 * The fetcher may return a page wider than {@link ListPage} (`TPage`); the
 * first one comes back as `firstPage`, so a list reads its server counts
 * without re-deriving the pages.
 */
export function useCursorList<T, TPage extends ListPage<T> = ListPage<T>>(args: {
  queryKey: QueryKey;
  queryFn: (after: string | undefined) => Promise<TPage & ListPage<T>>;
  enabled?: boolean;
  /** Toast the mapped error on failure (default: true). */
  notifyOnError?: boolean;
  /** Poll every loaded page this often, in ms, while the tab is visible (default: no polling). */
  refetchInterval?: number;
  /** Read every loaded page again when the window regains focus (default: TanStack's own). */
  refetchOnWindowFocus?: boolean;
}): CursorListResult<T, TPage> {
  const query = useInfiniteQuery({
    queryKey: args.queryKey,
    queryFn: ({ pageParam }) => args.queryFn(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.next ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    meta: { notifyOnError: args.notifyOnError ?? true },
    ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
    ...(args.refetchInterval !== undefined
      ? { refetchInterval: args.refetchInterval }
      : {}),
    ...(args.refetchOnWindowFocus !== undefined
      ? { refetchOnWindowFocus: args.refetchOnWindowFocus }
      : {}),
  });

  const { fetchNextPage } = query;
  const nextPageInFlight = useRef(false);

  /**
   * Single-flight `Load more`. `disabled={isFetchingNextPage}` is React state
   * and only lands a render later, so a double-click fires the handler twice and
   * appends the same page twice. The ref flips inside the first call
   * (agent-os/rules/fe-resilient-interactions.mdc section 1).
   */
  const loadNextPage = useCallback(() => {
    if (nextPageInFlight.current) return;
    nextPageInFlight.current = true;
    fetchNextPage()
      .catch(() => {
        // Errors surface through the query's own isError state; nothing to do.
      })
      .finally(() => {
        nextPageInFlight.current = false;
      });
  }, [fetchNextPage]);

  // One array per fetched result, not per render: a table keyed on it keeps its
  // row model, and a screen can tell new rows from the same rows (the last copy).
  const { data } = query;
  const rows = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);

  return {
    rows,
    firstPage: data?.pages[0],
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    isError: query.isError,
    isFetching: query.isFetching,
    isRefreshing: query.isPlaceholderData,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: loadNextPage,
    refetch: () => {
      query.refetch().catch(() => {
        // Errors surface through the query's own isError state; nothing to do.
      });
    },
  };
}
