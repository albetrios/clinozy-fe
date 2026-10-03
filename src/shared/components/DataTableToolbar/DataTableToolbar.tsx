'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import type { ReactTable, RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { DataTableSavedViews } from '@/shared/components/DataTableSavedViews/index.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTableToolbar/data-table.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Input } from '@/shared/components/ui/input.tsx';
import type { SavedViewFilters } from '@/shared/hooks/useSavedViews/index.ts';
import { Search, X } from '@/shared/icons/index.ts';
import type { SavedView } from '@/shared/store/useDevicePrefsStore/index.ts';

interface DataTableToolbarProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  /** Column id to bind the global search/filter input to. */
  searchColumnId?: string;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Persists the column choice and lists the saved views of this table. */
  tableId?: string;
  /** Apply a saved view; the saved-views track shows when it is given with `tableId`. */
  onApplyView?: (view: SavedView) => void;
  /** The filters applied now — the matching saved view shows pressed. */
  activeFilters?: SavedViewFilters;
  /** Extra controls rendered to the right of search (e.g. filter buttons). */
  children?: React.ReactNode;
}

/**
 * The search, filter and column controls above a `DataTable`: a search input
 * bound to one column, the caller's own controls, Reset while filtered, the
 * saved-views track and the Columns chooser (hidden below `md`).
 */
export function DataTableToolbar<TData extends RowData>({
  table,
  searchColumnId,
  searchPlaceholder,
  tableId,
  onApplyView,
  activeFilters,
  children,
}: DataTableToolbarProps<TData>) {
  const { t } = useTranslation(TABLE_NS);
  // Read the table's LIVE state every render — never memoise on `[table]`.
  // The table instance is built once and keeps its identity for the life of the
  // component, so a `useMemo` keyed on it is computed at mount and never again:
  // `searchValue` stayed frozen at '' (so the controlled input wiped every
  // keystroke while the rows filtered underneath) and `isFiltered` stayed frozen
  // at false (so the Reset button never appeared). These reads are two property
  // lookups; there is nothing here worth memoising.
  const isFiltered = table.state.columnFilters.length > 0;
  const searchColumn = searchColumnId ? table.getColumn(searchColumnId) : undefined;
  const searchValue = (searchColumn?.getFilterValue() as string) ?? '';

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* Search input */}
        {searchColumn && (
          <div className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder ?? t(TABLE_KEYS.searchPlaceholder)}
              value={searchValue}
              onChange={(e) => searchColumn.setFilterValue(e.target.value)}
              className="h-8 ps-9"
            />
          </div>
        )}

        {/* Extra filter controls from consumer */}
        {children}

        {/* Clear filters */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 sm:ms-auto">
        {tableId && onApplyView ? (
          <DataTableSavedViews
            tableId={tableId}
            activeFilters={activeFilters}
            onApply={onApplyView}
          />
        ) : null}
        <DataTableColumnChooser table={table} tableId={tableId} />
      </div>
    </div>
  );
}
