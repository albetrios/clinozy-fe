import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';

import { useRoomList } from './useRoomList.ts';

const { loadError } = vi.hoisted(() => ({ loadError: vi.fn() }));
vi.mock('@/shared/hooks/useListLoadError/index.ts', () => ({
  useListLoadError: loadError,
}));

/** A cursor list in the given state. */
function listOf(
  rows: readonly string[],
  state: Partial<CursorListResult<string>> = {},
): CursorListResult<string> {
  return {
    rows: [...rows],
    isPending: false,
    isError: false,
    isFetching: false,
    isRefreshing: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...state,
  };
}

beforeEach(() => {
  loadError.mockReset();
  // The load-error hook answers the rows to show — the read's own here.
  loadError.mockImplementation((list: CursorListResult<string>) => list.rows);
});

describe('useRoomList', () => {
  it('shows the skeleton on the first load, then the rows', () => {
    const { result, rerender } = renderHook(
      ({ list }) => useRoomList(list, 'medicines', 'q='),
      { initialProps: { list: listOf([], { isPending: true }) } },
    );
    expect(result.current.loading).toBe(true);
    rerender({ list: listOf(['a', 'b']) });
    expect(result.current).toEqual({ rows: ['a', 'b'], loading: false });
    expect(loadError).toHaveBeenLastCalledWith(
      expect.objectContaining({ isError: false }),
      'medicines',
    );
  });

  it('shimmers a new search but keeps the rows through a sort', () => {
    const { result, rerender } = renderHook(
      ({ list, key }) => useRoomList(list, 'medicines', key),
      { initialProps: { list: listOf(['a']), key: 'q=' } },
    );
    // A sort: the same filter key, refreshing — the rows stay.
    rerender({ list: listOf(['a'], { isRefreshing: true }), key: 'q=' });
    expect(result.current.loading).toBe(false);
    // A search: a new filter key while it loads — the skeleton.
    rerender({ list: listOf(['a'], { isRefreshing: true }), key: 'q=azel' });
    expect(result.current.loading).toBe(true);
    rerender({ list: listOf(['azelan']), key: 'q=azel' });
    expect(result.current).toEqual({ rows: ['azelan'], loading: false });
  });

  it('shows the last copy the load-error hook keeps while a read fails', () => {
    const { result, rerender } = renderHook(
      ({ list }) => useRoomList(list, 'medicines', 'q='),
      { initialProps: { list: listOf(['a', 'b']) } },
    );
    loadError.mockImplementation((list: CursorListResult<string>) =>
      list.isError ? ['a', 'b'] : list.rows,
    );
    rerender({ list: listOf([], { isError: true }) });
    expect(result.current.rows).toEqual(['a', 'b']);
    expect(loadError).toHaveBeenLastCalledWith(
      expect.objectContaining({ isError: true }),
      'medicines',
    );
  });
});
