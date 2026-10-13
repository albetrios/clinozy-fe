import {
  type ColumnDef,
  functionalUpdate,
  type OnChangeFn,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import {
  sortingFromSearch,
  sortingToSearch,
} from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

/** What {@link useRoomTable} needs from a room. */
export interface RoomTableInput<TRow extends { id: string }> {
  /** The table's id: the Columns choice's device-pref key. */
  tableId: string;
  columns: ColumnDef<DataTableFeatures, TRow>[];
  /** The rows on screen (the cursor pages so far). */
  rows: readonly TRow[];
  /** The URL's column sort (`name:asc`). */
  sort: string | undefined;
  /** Write a new sort to the URL (`undefined` clears it). */
  onSortChange: (sort: string | undefined) => void;
}

/**
 * A room list's table instance (KICKOFF §3.5 Data table): the server sorts —
 * a header cycles ascending → descending → off and writes the URL's `sort`,
 * which the list read follows (`manualSorting`); the Columns choice is a
 * device pref (`useHiddenColumns`, the recommended set hides each column's
 * `meta.defaultHidden`); the rows are the loaded cursor pages, keyed by id.
 */
export function useRoomTable<TRow extends { id: string }>({
  tableId,
  columns,
  rows,
  sort,
  onSortChange,
}: RoomTableInput<TRow>) {
  const visibility = useHiddenColumns(tableId, columns);
  const sorting = useMemo<SortingState>(() => sortingFromSearch(sort), [sort]);
  const onSortingChange: OnChangeFn<SortingState> = (updater) =>
    onSortChange(sortingToSearch(functionalUpdate(updater, sorting)));

  return useTable({
    features: dataTableFeatures,
    data: rows as TRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { sorting, columnVisibility: visibility.columnVisibility },
    onSortingChange,
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
