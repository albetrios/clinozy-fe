/**
 * Row groups for a `DataTable` body (the Agenda's days, KICKOFF §6.4): each run
 * of consecutive rows that share a group key sits under one header, and the
 * body becomes a list of entries — headers and rows — that the window
 * virtualises as one list. Pure, so the grouping is tested apart from React.
 */
import type { RowData } from '@tanstack/react-table';

import type { TableRow } from './data-table-layout.ts';

/** A group's header entry: its key, its rows (as loaded) and its place among the groups. */
export interface TableGroupEntry<TData extends RowData> {
  kind: 'group';
  /** Unique among the entries — a key can head two runs when the read is out of order. */
  id: string;
  key: string;
  rows: readonly TableRow<TData>[];
  /** 0 for the first group. */
  groupIndex: number;
}

/** A row entry: the row and its index among the rows (selection, j / k). */
interface TableRowEntry<TData extends RowData> {
  kind: 'row';
  id: string;
  row: TableRow<TData>;
  rowIndex: number;
}

/** One entry of a table body, in render order. */
export type TableEntry<TData extends RowData> =
  TableGroupEntry<TData> | TableRowEntry<TData>;

/** A table body as entries, and where each row and each entry's group sit among them. */
export interface TableEntries<TData extends RowData> {
  entries: TableEntry<TData>[];
  /** The entry index of each row, by row index. */
  entryOfRow: number[];
  /** The entry index of the group header each entry is under (−1 without groups). */
  groupOfEntry: number[];
}

/**
 * The body's entries: without `keyOf`, one entry per row; with it, a header
 * before each run of rows whose key differs from the row before.
 */
export function tableEntries<TData extends RowData>(
  rows: readonly TableRow<TData>[],
  keyOf?: (row: TData) => string,
): TableEntries<TData> {
  const entries: TableEntry<TData>[] = [];
  const entryOfRow: number[] = [];
  const groupOfEntry: number[] = [];
  let current: TableGroupEntry<TData> | null = null;
  let currentIndex = -1;
  let groupCount = 0;
  rows.forEach((row, rowIndex) => {
    if (keyOf) {
      const key = keyOf(row.original);
      if (current?.key !== key) {
        current = {
          kind: 'group',
          id: `group:${key}:${groupCount}`,
          key,
          rows: [],
          groupIndex: groupCount,
        };
        groupCount += 1;
        currentIndex = entries.length;
        entries.push(current);
        groupOfEntry.push(currentIndex);
      }
      (current.rows as TableRow<TData>[]).push(row);
    }
    entryOfRow.push(entries.length);
    groupOfEntry.push(currentIndex);
    entries.push({ kind: 'row', id: row.id, row, rowIndex });
  });
  return { entries, entryOfRow, groupOfEntry };
}
