'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import { flexRender, type Header, type RowData } from '@tanstack/react-table';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS } from '@/lib/i18n/locale.constants.ts';
import { DataTableColumnHeader } from '@/shared/components/DataTableColumnHeader/index.ts';

import { TABLE_KEYS, TABLE_NS, TABLE_TEST_IDS } from './data-table.constants.ts';
import { columnLabel, type TableColumn } from './data-table-layout.ts';
import { SelectionBox } from './DataTableRow.tsx';
import type { DataTableFeatures } from './table-features.ts';
import type { TableSelection } from './useTableSelection.ts';

function ariaSortOf<TData extends RowData>(
  column: TableColumn<TData>,
): 'ascending' | 'descending' | 'none' | undefined {
  if (!column.getCanSort()) return undefined;
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return 'none';
}

/** One column header: the shared sortable label, or the column's own header. */
function HeaderCell<TData extends RowData>({
  column,
  header,
}: {
  column: TableColumn<TData>;
  header: Header<DataTableFeatures, TData, unknown> | undefined;
}) {
  const custom = typeof column.columnDef.header === 'function';
  return (
    <div
      role="columnheader"
      tabIndex={-1}
      aria-sort={ariaSortOf(column)}
      className="min-w-0"
    >
      {custom && header ? (
        flexRender(column.columnDef.header, header.getContext())
      ) : (
        <DataTableColumnHeader column={column} title={columnLabel(column)} />
      )}
    </div>
  );
}

/**
 * The header row (H:677–679): outside the scroller so it never scrolls away,
 * `bg-canvas`, 11px/600 uppercase — the tri-state "Select all", the kept
 * columns and an unlabelled actions column. It follows the body sideways
 * through `headerRef` when every column shows.
 */
export function DataTableHeaderRow<TData extends RowData>({
  headerRef,
  columns,
  headers,
  selection,
  hasActions,
  prefix,
}: {
  headerRef: RefObject<HTMLDivElement | null>;
  columns: readonly TableColumn<TData>[];
  headers: ReadonlyMap<string, Header<DataTableFeatures, TData, unknown>>;
  selection: TableSelection<TData>;
  hasActions: boolean;
  prefix: string;
}) {
  const { t } = useTranslation(TABLE_NS);
  return (
    <div
      ref={headerRef}
      role="rowgroup"
      className="bg-canvas flex-none [scrollbar-gutter:stable] overflow-hidden border-b"
    >
      <div
        role="row"
        tabIndex={-1}
        aria-rowindex={1}
        data-testid={TABLE_TEST_IDS.header(prefix)}
        className="group/row text-micro text-muted-foreground grid min-w-(--dt-min-w) grid-cols-(--dt-cols) items-center gap-[var(--dt-gap,0.75rem)] px-(--table-pad-x) font-semibold tracking-[0.03em] uppercase"
      >
        {selection.enabled ? (
          <div
            role="columnheader"
            tabIndex={-1}
            className="flex items-center justify-center"
          >
            <SelectionBox
              checked={selection.headerChecked}
              label={t(LOCALE_KEYS.selectAll)}
              visible={selection.hasSelection}
              testId={TABLE_TEST_IDS.selectAll(prefix)}
              onToggle={() => selection.toggleAll()}
            />
          </div>
        ) : null}
        {columns.map((column) => (
          <HeaderCell key={column.id} column={column} header={headers.get(column.id)} />
        ))}
        {hasActions ? (
          <div role="columnheader" tabIndex={-1}>
            <span className="sr-only">{t(TABLE_KEYS.actions)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
