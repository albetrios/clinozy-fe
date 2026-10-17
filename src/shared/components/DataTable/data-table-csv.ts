import type { ReactTable, RowData } from '@tanstack/react-table';

import { downloadCsv, toCsv } from '@/lib/csv.ts';

import { columnLabel } from './data-table-layout.ts';
import type { DataTableFeatures } from './table-features.ts';

/** What {@link exportTableCsv} writes. */
export interface TableCsvExport<TData extends RowData> {
  /** The table whose visible columns become the file's columns, in order. */
  table: ReactTable<DataTableFeatures, TData>;
  /** The rows to write — the bulk bar's selection. */
  rows: readonly TData[];
  /** The download's name, e.g. `patients.csv`. */
  fileName: string;
  /** A column's own text for a row (a name with its phone); `undefined` falls through. */
  cell?: (columnId: string, row: TData) => string | undefined;
}

/** CSV text: an explicit export value, else folded text or the accessor value. */
function cellText<TData extends RowData>(
  table: ReactTable<DataTableFeatures, TData>,
  columnId: string,
  row: TData,
  index: number,
): string {
  const column = table.getColumn(columnId);
  const exported = column?.columnDef.meta?.exportValue?.(row);
  if (exported !== undefined) return exported === null ? '' : String(exported);
  const fold = column?.columnDef.meta?.foldValue?.(row);
  if (typeof fold === 'string') return fold;
  if (fold) return fold.value;
  // Hiding a detail on a small screen must not erase its data in a download.
  const value = column?.accessorFn?.(row, index);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * The bulk bar's "Export" (KICKOFF §6.0; Q-P8 — a real CSV): `rows` as a CSV
 * of the table's visible columns — each header the column's label, each cell
 * its explicit `meta.exportValue`, else its folded text (`meta.foldValue`) or
 * accessor value. A null fold only hides the responsive detail. `cell` answers
 * first when provided — downloaded as `fileName`.
 */
export function exportTableCsv<TData extends RowData>({
  table,
  rows,
  fileName,
  cell,
}: TableCsvExport<TData>): void {
  const columns = table.getVisibleLeafColumns();
  const headers = columns.map((column) => columnLabel(column));
  const records = rows.map((row, index) =>
    columns.map(
      (column) => cell?.(column.id, row) ?? cellText(table, column.id, row, index),
    ),
  );
  downloadCsv(fileName, toCsv(headers, records));
}
