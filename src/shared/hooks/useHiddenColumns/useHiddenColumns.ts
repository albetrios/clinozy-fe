import {
  type ColumnDef,
  type ColumnVisibilityState,
  functionalUpdate,
  type OnChangeFn,
  type RowData,
} from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

type AnyColumnDef<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

/** TanStack's own column-id rule: `id`, else the accessor key (dots → `_`), else a string header. */
function columnDefId<TData extends RowData>(
  def: AnyColumnDef<TData>,
): string | undefined {
  if ('id' in def && def.id) return def.id;
  if ('accessorKey' in def && def.accessorKey !== undefined) {
    return String(def.accessorKey).replaceAll('.', '_');
  }
  return typeof def.header === 'string' ? def.header : undefined;
}

/**
 * Ids of the columns the recommended set hides (`meta.defaultHidden`),
 * walking nested column groups.
 */
export function recommendedHiddenColumns<TData extends RowData>(
  columns: readonly AnyColumnDef<TData>[],
): string[] {
  return columns.flatMap((def) => {
    if ('columns' in def && def.columns) {
      return recommendedHiddenColumns(def.columns as readonly AnyColumnDef<TData>[]);
    }
    const id = columnDefId(def);
    return id && def.meta?.defaultHidden ? [id] : [];
  });
}

/**
 * A table's column visibility, persisted per table on this device
 * (`useDevicePrefsStore.hiddenColumns[tableId]`, KICKOFF §3.3). Until the user
 * changes anything the table shows its recommended set — every column but the
 * `meta.defaultHidden` ones. Spread the result into `useTable`:
 *
 * ```ts
 * const visibility = useHiddenColumns('patients', columns);
 * const table = useTable({
 *   features: dataTableFeatures, data, columns,
 *   state: { columnVisibility: visibility.columnVisibility },
 *   onColumnVisibilityChange: visibility.onColumnVisibilityChange,
 * });
 * ```
 */
export function useHiddenColumns<TData extends RowData>(
  tableId: string,
  columns: readonly AnyColumnDef<TData>[],
): {
  columnVisibility: ColumnVisibilityState;
  onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState>;
} {
  const stored = useDevicePrefsStore((state) => state.hiddenColumns[tableId]);
  const setHiddenColumns = useDevicePrefsStore((state) => state.setHiddenColumns);
  // Keyed by content, not identity: columns declared inline are a new array on
  // every render, and a new visibility object each time would re-publish the
  // table's state on every render.
  const hiddenKey = (stored ?? recommendedHiddenColumns(columns)).join('\n');

  const columnVisibility = useMemo<ColumnVisibilityState>(
    () =>
      Object.fromEntries(
        hiddenKey === '' ? [] : hiddenKey.split('\n').map((id) => [id, false]),
      ),
    [hiddenKey],
  );

  const onColumnVisibilityChange = useCallback<OnChangeFn<ColumnVisibilityState>>(
    (updater) => {
      const next = functionalUpdate(updater, columnVisibility);
      setHiddenColumns(
        tableId,
        Object.keys(next).filter((id) => next[id] === false),
      );
    },
    [columnVisibility, setHiddenColumns, tableId],
  );

  return { columnVisibility, onColumnVisibilityChange };
}
