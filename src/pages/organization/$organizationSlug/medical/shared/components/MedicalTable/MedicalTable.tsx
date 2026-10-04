'use no memo';
// TanStack Table reads live table state through methods on objects that keep
// their identity; React Compiler memoisation would serve stale answers.

import type { ReactTable } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { MedicalTab } from '@/lib/routes/index.ts';
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
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import type { CursorListResult } from '@/shared/hooks/useCursorList/index.ts';
import { FileIcon, Pill } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';

/** The room's section tone (`medical.md:11`). */
const MEDICAL_TONE: Tone = 'blush';

/** Props of {@link MedicalTable}. */
export interface MedicalTableProps<TRow extends { id: string }> {
  tab: MedicalTab;
  table: ReactTable<DataTableFeatures, TRow>;
  list: Pick<
    CursorListResult<TRow>,
    'hasNextPage' | 'isFetchingNextPage' | 'fetchNextPage'
  >;
  /** The skeleton shows (`useRoomList`). */
  loading: boolean;
  /** Filters or a search apply: the empty state is the filtered one. */
  filtered: boolean;
  onClearFilters: () => void;
  /** The tab's empty title ("No medicine matches"). */
  emptyTitle: string;
  /** The tab's "New …" under its empty state (PRD.md:232). */
  emptyAction?: { label: string; onSelect: () => void };
  /** The end line's noun ("All sales loaded"). */
  recordsLabel: string;
  /** The footer's count ("3 sales"); Medicines and Payments have none. */
  countLabel?: string;
  /** The row showing every column (`medical.md:30–126`). */
  minWidth: number;
  onRowClick?: (row: TRow) => void;
  /** The 3px status edge's tone. */
  rowTone?: (row: TRow) => Tone | undefined;
  rowActions?: (row: TRow) => readonly DataTableRowAction[];
  /** The export file ("medicines.csv"); the bulk bar's Export needs the `export` ability. */
  exportName: string;
  /** A cell's own export text (a person cell's name and phone). */
  exportValue?: TableCsvExport<TRow>['cell'];
  /** Person rows: the skeleton leads with an avatar. */
  avatar?: boolean;
  /** Extra bulk actions after Export. */
  bulkActions?: readonly DataTableBulkAction<TRow>[];
  children?: ReactNode;
}

/**
 * A Medical tab's table (KICKOFF §6.7 Tables): the shared table with folds on
 * a tablet and rows on a phone, selection and the bulk bar from `md` (Export
 * as CSV with the `export` ability), the row actions, infinite scroll over
 * cursor pages, the footer count and end line, and the room's states — the
 * skeleton, the blush empty state with the tab's "New …", the filtered one.
 */
export function MedicalTable<TRow extends { id: string }>({
  tab,
  table,
  list,
  loading,
  filtered,
  onClearFilters,
  emptyTitle,
  emptyAction,
  recordsLabel,
  countLabel,
  minWidth,
  onRowClick,
  rowTone,
  rowActions,
  exportName,
  exportValue,
  avatar = false,
  bulkActions = [],
}: MedicalTableProps<TRow>) {
  const { t } = useTranslation(MEDICAL_NS);
  const access = useClinicAccess();
  const exportAction: DataTableBulkAction<TRow>[] =
    access.isResolved && access.canAbility('export')
      ? [
          {
            id: 'export',
            label: t(MEDICAL_KEYS.bulk.export),
            icon: FileIcon,
            onSelect: (selected) => {
              exportTableCsv({
                table,
                rows: selected,
                fileName: exportName,
                cell: exportValue,
              });
              notify.success(t(MEDICAL_KEYS.bulk.exported, { count: selected.length }));
            },
          },
        ]
      : [];

  return (
    <DataTable
      table={table}
      tableId={MEDICAL_TABLE_IDS[tab]}
      label={t(MEDICAL_KEYS.tabs[tab])}
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
          tone={MEDICAL_TONE}
          icon={<Pill />}
          title={emptyTitle}
          description={t(MEDICAL_KEYS.empty.hint)}
          action={
            emptyAction ? (
              <EmptyStateAction onClick={emptyAction.onSelect}>
                {emptyAction.label}
              </EmptyStateAction>
            ) : undefined
          }
          label={t(MEDICAL_KEYS.tabs[tab])}
          avatar={avatar}
        />
      }
      className="m-(--room-card-margin) flex-1"
    />
  );
}
