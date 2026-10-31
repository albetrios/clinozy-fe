import {
  focusManager,
  type InfiniteData,
  keepPreviousData,
  type QueryKey,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react';

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

/** The last part of the key a poll reads the first page under — its own query, beside the list's. */
const FIRST_PAGE_POLL = 'first-page-poll';

/** A row's `id` as text, or `null` for a row without one. */
function rowIdOf(row: unknown): string | null {
  if (typeof row !== 'object' || row === null || !('id' in row)) return null;
  const { id } = row as { id: unknown };
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

/**
 * Whether a freshly read first page still ends where the cached one did — the same rows, by
 * `id`, in the same order, and the same forward cursor — so the pages after it still follow on.
 * A row without an `id` never matches: the loaded pages are then read again rather than guessed.
 */
function sameFirstPage(cached: ListPage<unknown> | undefined, fresh: ListPage<unknown>) {
  if (!cached) return false;
  if (cached.next !== fresh.next || cached.hasMore !== fresh.hasMore) return false;
  if (cached.rows.length !== fresh.rows.length) return false;
  return cached.rows.every((row, index) => {
    const id = rowIdOf(row);
    return id !== null && id === rowIdOf(fresh.rows[index]);
  });
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
 *
 * **A poll reads the first page, not every page loaded (G-2).** TanStack's own
 * `refetchInterval` re-reads every loaded page in turn, so a list scrolled ten
 * pages deep sent ten requests (and a joined list ten more) every tick. The
 * poll here reads the first page alone and puts it in front of the pages after
 * it — the top of a list is where new and due rows land. Only when that page
 * holds other rows, or another cursor, than before (a row crossed into or out
 * of it, so the pages after it no longer start where they did) are the loaded
 * pages read again; a keyset cursor cannot re-seat them any other way. Deeper
 * pages refresh with a write's invalidation, a retry or a new view. There is
 * no `maxPages` cap: clinozy-be's keyset lists only page forward, and TanStack
 * drops the FIRST page past the cap, which nothing could then load back.
 */
export function useCursorList<T, TPage extends ListPage<T> = ListPage<T>>(args: {
  queryKey: QueryKey;
  queryFn: (after: string | undefined) => Promise<TPage & ListPage<T>>;
  enabled?: boolean;
  /** Toast the mapped error on failure (default: true). */
  notifyOnError?: boolean;
  /**
   * Read the first page again this often, in ms, while the tab is visible (default: no
   * polling) — the pages after it only when it moved (see {@link useCursorList}).
   */
  refetchInterval?: number;
  /** Read every loaded page again when the window regains focus (default: TanStack's own). */
  refetchOnWindowFocus?: boolean;
}): CursorListResult<T, TPage> {
  const queryClient = useQueryClient();
  const notifyOnError = args.notifyOnError ?? true;
  const enabled = args.enabled ?? true;
  const query = useInfiniteQuery({
    queryKey: args.queryKey,
    queryFn: ({ pageParam }) => args.queryFn(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.next ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    meta: { notifyOnError },
    ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
    ...(args.refetchOnWindowFocus !== undefined
      ? { refetchOnWindowFocus: args.refetchOnWindowFocus }
      : {}),
  });

  const { fetchNextPage, refetch: refetchLoadedPages } = query;

  /** One poll tick: the first page alone, unless it is all there is or it moved. */
  const pollFirstPage = useEffectEvent(async () => {
    const queryKey = args.queryKey;
    const state =
      queryClient.getQueryState<InfiniteData<TPage, string | undefined>>(queryKey);
    // A first load, a next page or a refetch is already out: its answer is as fresh.
    if (state?.fetchStatus !== 'idle') return;
    const loaded = state.data;
    if (!loaded || loaded.pages.length <= 1) {
      await refetchLoadedPages().catch(() => undefined);
      return;
    }
    let head: TPage;
    try {
      // A query of its own, so a failed poll is reported, toasted and retried like any read,
      // and a workspace switch cancels it with the rest of the organization's reads.
      head = await queryClient.query({
        queryKey: [...queryKey, FIRST_PAGE_POLL],
        queryFn: () => args.queryFn(undefined),
        staleTime: 0,
        gcTime: 0,
        meta: { notifyOnError },
      });
    } catch {
      return; // said by the query cache; the rows on screen stay
    }
    // A next page, a write's patch or a refetch landed meanwhile: what it wrote stands.
    if (queryClient.getQueryData(queryKey) !== loaded) return;
    if (!sameFirstPage(loaded.pages[0], head)) {
      await refetchLoadedPages().catch(() => undefined);
      return;
    }
    queryClient.setQueryData<InfiniteData<TPage, string | undefined>>(queryKey, {
      ...loaded,
      pages: [head, ...loaded.pages.slice(1)],
    });
  });

  const pollEvery = args.refetchInterval;
  useEffect(() => {
    if (pollEvery === undefined || !enabled) return;
    const timer = setInterval(() => {
      // As TanStack's own interval: no polling while the tab is in the background.
      if (focusManager.isFocused()) void pollFirstPage();
    }, pollEvery);
    return () => clearInterval(timer);
  }, [pollEvery, enabled]);
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
