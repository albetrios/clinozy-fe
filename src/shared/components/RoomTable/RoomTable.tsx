'use no memo';
// TanStack Table reads live table state through methods on objects that keep
// their identity; React Compiler memoisation would serve stale answers.

import type { ReactTable } from '@tanstack/react-table';
import type { ReactNode } from 'react';

import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  DataTable,
  type DataTableFeatures,
  exportTableCsv,
  type TableCsvExport,
} from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import { RoomTableEmpty } from '@/shared/components/RoomTableEmpty/index.ts';
import { canExportRows, useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import { FileIcon } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

/** Props of {@link RoomTable}. */
export interface RoomTableProps<TRow extends { id: string }> {
  table: ReactTable<DataTableFeatures, TRow>;
  /** The table's id — its test ids, saved views and Columns choice. */
  tableId: string;
  /** The table's accessible name — the tab's. */
  label: string;
  list: Pick<
    CursorListResult<TRow>,
    'hasNextPage' | 'isFetchingNextPage' | 'fetchNextPage'
  >;
  /** The skeleton shows (`useRoomList`). */
  loading: boolean;
  /** Filters or a search apply: the empty state is the filtered one. */
  filtered: boolean;
  onClearFilters: () => void;
  /** The room's section tone — the empty state's tile. */
  tone: Tone;
  /** The empty state's 18px glyph. */
  icon: ReactNode;
  /** The tab's empty title ("No medicine matches"). */
  emptyTitle: string;
  /** The rooms' hint under it ("Nothing here yet. Try another tab or search."). */
  emptyHint: string;
  /** The tab's "New …" under its empty state (PRD.md:232). */
  emptyAction?: { label: string; onSelect: () => void };
  /** The end line's noun ("All sales loaded"). */
  recordsLabel: string;
  /** The footer's count ("3 sales"); some tabs have none. */
  countLabel?: string;
  /** The row showing every column. */
  minWidth: number;
  onRowClick?: (row: TRow) => void;
  /** The 3px status edge's tone. */
  rowTone?: (row: TRow) => Tone | undefined;
  rowActions?: (row: TRow) => readonly DataTableRowAction[];
  /**
   * The export file ("medicines.csv"); the bulk bar's Export needs `exportCode` on a room on
   * clinozy-be, else the matrix's `export` ability ({@link canExportRows}).
   */
  exportName: string;
  /** The clinozy-be export code of a room on the API (`stock_item:export`); none on fixtures. */
  exportCode?: string;
  /** A cell's own export text (a person cell's name and phone). */
  exportValue?: TableCsvExport<TRow>['cell'];
  /** The room's words for Export and its toast ("3 rows exported as CSV"). */
  exportCopy: { label: string; done: (count: number) => string };
  /** Person rows: the skeleton leads with an avatar. */
  avatar?: boolean;
  /** Extra bulk actions after Export. */
  bulkActions?: readonly DataTableBulkAction<TRow>[];
}

/**
 * A room tab's table (KICKOFF §3.5 Tables, §6.0 States) — the Medical and
 * Clinic stock tabs: the shared table with folds on a tablet and rows on a
 * phone, selection and the bulk bar from `md` (Export as CSV with the
 * `export` ability, Q-P8), the row actions, infinite scroll over cursor pages,
 * the footer count and end line, and the room's states — the skeleton, the
 * empty state in the room's tone with the tab's "New …", the filtered one.
 */
export function RoomTable<TRow extends { id: string }>({
  table,
  tableId,
  label,
  list,
  loading,
  filtered,
  onClearFilters,
  tone,
  icon,
  emptyTitle,
  emptyHint,
  emptyAction,
  recordsLabel,
  countLabel,
  minWidth,
  onRowClick,
  rowTone,
  rowActions,
  exportName,
  exportCode,
  exportValue,
  exportCopy,
  avatar = false,
  bulkActions = [],
}: RoomTableProps<TRow>) {
  const access = useClinicAccess();
  const exportAction: DataTableBulkAction<TRow>[] =
    canExportRows(access, exportCode)
      ? [
          {
            id: 'export',
            label: exportCopy.label,
            icon: FileIcon,
            onSelect: (selected) => {
              exportTableCsv({
                table,
                rows: selected,
                fileName: exportName,
                cell: exportValue,
              });
              notify.success(exportCopy.done(selected.length));
            },
          },
        ]
      : [];

  return (
    <DataTable
      table={table}
      tableId={tableId}
      label={label}
      recordsLabel={recordsLabel}
      countLabel={countLabel}
      fold
      selectable
      minWidth={minWidth}
      onRowClick={onRowClick ? (row) => onRowClick(row.original) : undefined}
      getRowTone={rowTone ? (row) => rowTone(row.original) : undefined}
      rowActions={rowActions ? (row) => rowActions(row.original) : undefined}
      bulkActions={[...exportAction, ...bulkActions]}
      hasNextPage={!loading && list.hasNextPage}
      isFetchingNextPage={list.isFetchingNextPage}
      fetchNextPage={list.fetchNextPage}
      empty={
        <RoomTableEmpty
          loading={loading}
          filtered={filtered}
          onClearFilters={onClearFilters}
          tone={tone}
          icon={icon}
          title={emptyTitle}
          description={emptyHint}
          action={
            emptyAction ? (
              <EmptyStateAction onClick={emptyAction.onSelect}>
                {emptyAction.label}
              </EmptyStateAction>
            ) : undefined
          }
          label={label}
          avatar={avatar}
        />
      }
      className="m-(--room-card-margin) flex-1"
    />
  );
}
