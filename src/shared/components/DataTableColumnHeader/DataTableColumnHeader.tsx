'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import type { Column, RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { ArrowDown, ArrowUp, ArrowUpDown } from '@/shared/icons/index.ts';

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.ComponentProps<'div'> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
}

/**
 * Sort cycle of a header click (KICKOFF §3.5 Header): ascending → descending
 * → off — for every column, whatever direction TanStack would auto-pick first.
 * A `sortStartsDescending` column runs descending → off ("newest first",
 * H:6147).
 */
function cycleSort<TData extends RowData, TValue>(
  column: Column<DataTableFeatures, TData, TValue>,
) {
  const sorted = column.getIsSorted();
  if (column.columnDef.meta?.sortStartsDescending) {
    if (sorted) column.clearSorting();
    else column.toggleSorting(true);
    return;
  }
  if (sorted === 'asc') column.toggleSorting(true);
  else if (sorted === 'desc') column.clearSorting();
  else column.toggleSorting(false);
}

/**
 * A table's header label: 11px/600 uppercase. A sortable column is a 40px
 * button (the table's `--dt-head-h` when it sets one — the Agenda's 37px) whose click cycles ascending → descending → off, with `ArrowUpDown`
 * at 45% while idle and `ArrowUp` / `ArrowDown` once sorted (H:4167). The sort
 * state lives on the `columnheader` as `aria-sort` (set by `DataTable`).
 */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation(TABLE_NS);
  const alignEnd = column.columnDef.meta?.align === 'end';

  if (!column.getCanSort()) {
    return (
      <div
        className={cn(
          'flex h-[var(--dt-head-h,2.5rem)] min-w-0 items-center',
          alignEnd && 'justify-end text-end',
          className,
        )}
      >
        <span className="truncate">{title}</span>
      </div>
    );
  }

  const sorted = column.getIsSorted();
  let SortIcon = ArrowUpDown;
  if (sorted === 'asc') SortIcon = ArrowUp;
  else if (sorted === 'desc') SortIcon = ArrowDown;

  return (
    <button
      type="button"
      title={t(TABLE_KEYS.sortBy, { column: title })}
      onClick={() => cycleSort(column)}
      className={cn(
        // The 6px bleed lets the hover fill reach past the column gap (H:678).
        '-mx-1.5 flex h-[var(--dt-head-h,2.5rem)] w-[calc(100%+0.75rem)] min-w-0 items-center px-1.5 tracking-[inherit] uppercase transition-colors duration-120',
        'hover:bg-muted-strong',
        sorted ? 'bg-muted-strong text-foreground' : 'text-muted-foreground',
        alignEnd && 'justify-end',
        className,
      )}
    >
      {/*
        A start-aligned label may run into the button's end padding before it
        truncates: the design's label never truncates there, its arrow slides
        into the padding ("MANUFACTURER" in a 110px track, H:678).
      */}
      <span
        data-slot="sort-label"
        className={cn('flex min-w-0 items-center gap-1', !alignEnd && '-me-1.5')}
      >
        <span className="truncate">{title}</span>
        <SortIcon
          aria-hidden="true"
          className={cn('size-3 flex-none', sorted ? 'opacity-100' : 'opacity-45')}
        />
      </span>
    </button>
  );
}
