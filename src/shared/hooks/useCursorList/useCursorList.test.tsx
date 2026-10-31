import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPage } from '@/shared/api/fetch-list-page.ts';

import { useCursorList } from './useCursorList.ts';

type Row = { id: string };

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe('useCursorList', () => {
  it('flattens the first page into rows and reflects hasNextPage', async () => {
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockResolvedValue({
        rows: [{ id: 'a' }, { id: 'b' }],
        next: 'cur_1',
        hasMore: true,
      });

    const { result } = renderHook(
      () => useCursorList<Row>({ queryKey: ['list', 'a'], queryFn }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.current.hasNextPage).toBe(true);
    expect(queryFn).toHaveBeenCalledWith(undefined);
  });

  it('hands back the first page as fetched, wider than a ListPage, and isSuccess', async () => {
    type CountedPage = ListPage<Row> & { total: number | null };
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<CountedPage>>()
      .mockResolvedValueOnce({
        rows: [{ id: 'a' }],
        next: 'cur_1',
        hasMore: true,
        total: 2,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'b' }],
        next: null,
        hasMore: false,
        total: 9,
      });

    const { result } = renderHook(
      () => useCursorList({ queryKey: ['list', 'counted'], queryFn }),
      { wrapper },
    );

    expect(result.current.firstPage).toBeUndefined();
    expect(result.current.isSuccess).toBe(false);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.firstPage?.total).toBe(2);

    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    // The counts stay the first page's: a later page does not replace them.
    expect(result.current.firstPage?.total).toBe(2);
  });

  it('keeps one rows array per fetched result, not one per render', async () => {
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockResolvedValue({ rows: [{ id: 'a' }], next: null, hasMore: false });

    const { result, rerender } = renderHook(
      () => useCursorList<Row>({ queryKey: ['list', 'stable'], queryFn }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    const rows = result.current.rows;
    rerender();
    expect(result.current.rows).toBe(rows);
  });

  it('accumulates rows and passes the forward cursor as `after` on fetchNextPage', async () => {
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockResolvedValueOnce({ rows: [{ id: 'a' }], next: 'cur_1', hasMore: true })
      .mockResolvedValueOnce({ rows: [{ id: 'b' }], next: null, hasMore: false });

    const { result } = renderHook(
      () => useCursorList<Row>({ queryKey: ['list', 'b'], queryFn }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.current.hasNextPage).toBe(false);
    expect(queryFn).toHaveBeenNthCalledWith(2, 'cur_1');
  });

  it('keeps the previous rows on screen while new params load (X-2)', async () => {
    // search/sort live in the query key, so a keystroke is a whole new query.
    // Assigned synchronously by the Promise executor below.
    let resolveSecond!: (page: ListPage<Row>) => void;
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockResolvedValueOnce({ rows: [{ id: 'a' }], next: null, hasMore: false })
      .mockImplementationOnce(
        () =>
          new Promise<ListPage<Row>>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) =>
        useCursorList<Row>({ queryKey: ['list', 'search', q], queryFn }),
      { wrapper, initialProps: { q: '' } },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    rerender({ q: 'ad' });

    // Without keepPreviousData this is the frame that blanks: rows empty,
    // isPending true, and the panel swaps the list for a skeleton.
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(result.current.rows).toEqual([{ id: 'a' }]);
    expect(result.current.isPending).toBe(false);

    await act(async () => {
      resolveSecond({ rows: [{ id: 'ada' }], next: null, hasMore: false });
    });
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'ada' }]));
    expect(result.current.isRefreshing).toBe(false);
  });

  it('sends one page request for a double-clicked Load more', async () => {
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockResolvedValueOnce({ rows: [{ id: 'a' }], next: 'cur_1', hasMore: true })
      .mockResolvedValue({ rows: [{ id: 'b' }], next: null, hasMore: false });

    const { result } = renderHook(
      () => useCursorList<Row>({ queryKey: ['list', 'dbl'], queryFn }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    // Both clicks land in one frame — `disabled={isFetchingNextPage}` has not
    // re-rendered yet, so only the synchronous ref can stop the second fetch.
    act(() => {
      result.current.fetchNextPage();
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('toasts a failed fetch by default, and stays quiet only when asked (X-3)', async () => {
    const seen: unknown[] = [];
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
      queryCache: new QueryCache({
        onError: (_error, query) => seen.push(query.meta?.notifyOnError),
      }),
    });
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockRejectedValue(new Error('500'));

    const { result } = renderHook(
      () => useCursorList<Row>({ queryKey: ['list', 'loud'], queryFn }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    const quiet = renderHook(
      () =>
        useCursorList<Row>({
          queryKey: ['list', 'quiet'],
          queryFn,
          notifyOnError: false,
        }),
      { wrapper },
    );
    await waitFor(() => expect(quiet.result.current.isError).toBe(true));

    expect(seen).toEqual([true, false]);
  });

  it('polls a one-page list at the given interval, and not without one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const queryFn = vi
        .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
        .mockResolvedValue({ rows: [{ id: 'a' }], next: null, hasMore: false });
      const still = vi
        .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
        .mockResolvedValue({ rows: [{ id: 'b' }], next: null, hasMore: false });

      renderHook(
        () =>
          useCursorList<Row>({
            queryKey: ['list', 'poll'],
            queryFn,
            refetchInterval: 60_000,
          }),
        { wrapper },
      );
      renderHook(
        () => useCursorList<Row>({ queryKey: ['list', 'still'], queryFn: still }),
        {
          wrapper,
        },
      );
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
      expect(still).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Three pages loaded under a 60s poll; `pages` answers each cursor (`undefined` = the first). */
  async function threePagesPolled(pages: Map<string | undefined, ListPage<Row>>) {
    const queryFn = vi.fn<(after: string | undefined) => Promise<ListPage<Row>>>(
      async (after) => pages.get(after) ?? { rows: [], next: null, hasMore: false },
    );
    const view = renderHook(
      () =>
        useCursorList<Row>({
          queryKey: ['list', 'deep'],
          queryFn,
          refetchInterval: 60_000,
        }),
      { wrapper },
    );
    await waitFor(() => expect(view.result.current.rows).toHaveLength(2));
    act(() => view.result.current.fetchNextPage());
    await waitFor(() => expect(view.result.current.rows).toHaveLength(4));
    act(() => view.result.current.fetchNextPage());
    await waitFor(() => expect(view.result.current.rows).toHaveLength(5));
    queryFn.mockClear();
    return { ...view, queryFn };
  }

  const firstPage = (...ids: string[]): ListPage<Row> => ({
    rows: ids.map((id) => ({ id })),
    next: 'cur_2',
    hasMore: true,
  });

  it('reads the first page alone on a poll tick, however many pages are loaded (G-2)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const pages = new Map<string | undefined, ListPage<Row>>([
        [undefined, firstPage('a', 'b')],
        ['cur_2', { rows: [{ id: 'c' }, { id: 'd' }], next: 'cur_3', hasMore: true }],
        ['cur_3', { rows: [{ id: 'e' }], next: null, hasMore: false }],
      ]);
      const { result, queryFn } = await threePagesPolled(pages);

      // The same rows come back, one of them changed: one request, the change on screen.
      pages.set(undefined, {
        ...firstPage('a', 'b'),
        rows: [{ id: 'a' }, { id: 'b', seen: true } as Row],
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await waitFor(() =>
        expect(result.current.rows[1]).toEqual({ id: 'b', seen: true }),
      );
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(queryFn).toHaveBeenCalledWith(undefined);
      expect(result.current.rows.map((row) => row.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the loaded pages again when the first page moved — a row crossed its end', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const pages = new Map<string | undefined, ListPage<Row>>([
        [undefined, firstPage('a', 'b')],
        ['cur_2', { rows: [{ id: 'c' }, { id: 'd' }], next: 'cur_3', hasMore: true }],
        ['cur_3', { rows: [{ id: 'e' }], next: null, hasMore: false }],
      ]);
      const { result, queryFn } = await threePagesPolled(pages);

      // `a` was resolved elsewhere: `c` moves up, every page after the first starts one later.
      pages.set(undefined, {
        rows: [{ id: 'b' }, { id: 'c' }],
        next: 'cur_2b',
        hasMore: true,
      });
      pages.set('cur_2b', {
        rows: [{ id: 'd' }, { id: 'e' }],
        next: null,
        hasMore: false,
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await waitFor(() =>
        expect(result.current.rows.map((row) => row.id)).toEqual(['b', 'c', 'd', 'e']),
      );
      // The poll's own read of the first page, then the loaded pages read again.
      expect(queryFn.mock.calls.map(([after]) => after)).toEqual([
        undefined,
        undefined,
        'cur_2b',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fetch when disabled', () => {
    const queryFn = vi
      .fn<(after: string | undefined) => Promise<ListPage<Row>>>()
      .mockResolvedValue({ rows: [], next: null, hasMore: false });

    renderHook(
      () => useCursorList<Row>({ queryKey: ['list', 'c'], queryFn, enabled: false }),
      { wrapper },
    );

    expect(queryFn).not.toHaveBeenCalled();
  });
});
