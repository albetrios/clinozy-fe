import { useState } from 'react';

import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';

/** What {@link useRoomList} hands the room: the rows to show and whether to shimmer them. */
export interface RoomListView<T> {
  /** The rows on screen — the last copy while a read fails with nothing loaded. */
  rows: readonly T[];
  /**
   * The table shows its skeleton: the first load, or a new search or filter
   * still loading. A sort or a view change keeps the rows until the new page
   * arrives (KICKOFF §6.0 Table refresh).
   */
  loading: boolean;
}

/**
 * A room list's screen state (KICKOFF §6.0 States): the rows stay on a failed
 * read — "Showing the last copy", with the rooms' one list-error toast and
 * "Retry" (`useListLoadError`) — and the skeleton shows on the first load and
 * while a changed `filterKey` (the search and the applied filters, never the
 * sort) is still loading.
 *
 * @param listId The list's id: one error toast per list.
 * @param filterKey The read's filter part, serialised — a change shimmers the rows.
 */
export function useRoomList<T>(
  list: CursorListResult<T>,
  listId: string,
  filterKey: string,
): RoomListView<T> {
  const [lastCopy, setLastCopy] = useState<readonly T[]>(list.rows);
  const settled = !(list.isError || list.isPending);
  if (settled && list.rows !== lastCopy) setLastCopy(list.rows);
  useListLoadError(list, listId);

  const [settledFilterKey, setSettledFilterKey] = useState(filterKey);
  if (!(list.isPending || list.isRefreshing) && settledFilterKey !== filterKey) {
    setSettledFilterKey(filterKey);
  }
  const loading = list.isPending || (list.isRefreshing && settledFilterKey !== filterKey);
  return {
    rows: list.isError && list.rows.length === 0 ? lastCopy : list.rows,
    loading,
  };
}
