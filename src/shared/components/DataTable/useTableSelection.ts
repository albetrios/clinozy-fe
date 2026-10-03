'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import type { ReactTable, RowData } from '@tanstack/react-table';
import { useEffect, useEffectEvent, useRef } from 'react';

import type { TableRow } from './data-table-layout.ts';
import type { DataTableFeatures } from './table-features.ts';

/** A table's row selection as the shared chrome uses it (KICKOFF §3.5 Selection). */
export interface TableSelection<TData extends RowData> {
  /** Selection is on: from `md` up, when the table asks for it (D31). */
  enabled: boolean;
  /** Loaded rows that can be selected. */
  selectableRows: readonly TableRow<TData>[];
  /** Loaded rows selected now. */
  selectedRows: readonly TableRow<TData>[];
  hasSelection: boolean;
  /** Tri-state of the header's "Select all". */
  headerChecked: boolean | 'indeterminate';
  /** Toggle one row; `extend` (shift) selects the range from the last toggled row. */
  toggleRow: (row: TableRow<TData>, index: number, extend: boolean) => void;
  /** The header box: everything when not all are selected, else nothing. */
  toggleAll: () => void;
  selectAll: () => void;
  clear: () => void;
}

/** True when the key press belongs to an open dialog, menu or listbox. */
export function insideOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]',
    ) !== null
  );
}

/**
 * Row selection over the loaded rows: tri-state select-all, shift-range from
 * the last toggled row (H:4196), and Esc clearing a live selection — unless the
 * Esc belongs to an open overlay, which handles it first.
 */
export function useTableSelection<TData extends RowData>(
  table: ReactTable<DataTableFeatures, TData>,
  rows: readonly TableRow<TData>[],
  enabled: boolean,
): TableSelection<TData> {
  const lastToggled = useRef<number | null>(null);
  const selectableRows = enabled ? rows.filter((row) => row.getCanSelect()) : [];
  const selectedRows = enabled ? rows.filter((row) => row.getIsSelected()) : [];
  const hasSelection = selectedRows.length > 0;
  const allSelected =
    selectableRows.length > 0 && selectedRows.length === selectableRows.length;
  let headerChecked: boolean | 'indeterminate' = false;
  if (allSelected) headerChecked = true;
  else if (hasSelection) headerChecked = 'indeterminate';

  const select = (targets: readonly TableRow<TData>[]) =>
    table.setRowSelection((previous) => ({
      ...previous,
      ...Object.fromEntries(targets.map((row) => [row.id, true])),
    }));
  const clear = () => table.setRowSelection({});
  const selectAll = () => select(selectableRows);

  const toggleRow = (row: TableRow<TData>, index: number, extend: boolean) => {
    const anchor = lastToggled.current;
    if (extend && anchor !== null && anchor !== index) {
      const from = Math.min(anchor, index);
      const to = Math.max(anchor, index);
      select(rows.slice(from, to + 1).filter((candidate) => candidate.getCanSelect()));
    } else {
      row.toggleSelected(!row.getIsSelected());
    }
    lastToggled.current = index;
  };

  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || insideOverlay(event.target)) {
      return;
    }
    table.setRowSelection({});
  });
  useEffect(() => {
    if (!hasSelection) return undefined;
    const listener = (event: KeyboardEvent) => onEscape(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [hasSelection]);

  return {
    enabled,
    selectableRows,
    selectedRows,
    hasSelection,
    headerChecked,
    toggleRow,
    toggleAll: () => (allSelected ? clear() : selectAll()),
    selectAll,
    clear,
  };
}
