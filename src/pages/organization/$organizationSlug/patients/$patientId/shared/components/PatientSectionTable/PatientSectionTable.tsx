'use no memo';
// TanStack Table reads live table state through methods on objects that keep
// their identity; React Compiler memoisation would serve stale answers.

import type { ReactTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import type { Tone } from '@/shared/api/app/app-schema.ts';
import { isBillingSection } from '@/shared/app/patient-file-sections.ts';
import {
  DataTable,
  type DataTableFeatures,
  exportTableCsv,
} from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RoomTableEmpty } from '@/shared/components/RoomTableEmpty/index.ts';
import { canExportRows, useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { FileIcon } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PATIENT_FILE_KEYS } from '../../patient-file.constants.ts';
import {
  PATIENT_FILE_SECTION_ICONS,
  PATIENT_FILE_SECTION_TONES,
} from '../../patient-file-nav.ts';
import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  type PatientTableSection,
} from './patient-section-table.constants.ts';

/** Props of {@link PatientSectionTable}. */
export interface PatientSectionTableProps<TRow extends { id: string }> {
  section: PatientTableSection;
  table: ReactTable<DataTableFeatures, TRow>;
  /** The first read is out: the flat skeleton over the rows' place. */
  loading: boolean;
  /** The footer's count ("3 appointments", "2 invoices · ₹1,500 due"). */
  countLabel?: string;
  /** The row showing every column (H:4746–4760: 760 · 1100 · 1330 · 1120). */
  minWidth: number;
  onRowClick?: (row: TRow) => void;
  /** The 3px start bar's tone (Visits and Invoices: the status; Payments: refunds). */
  rowTone?: (row: TRow) => Tone | undefined;
  rowActions?: (row: TRow) => readonly DataTableRowAction[];
  /** Infinite scroll over cursor pages (the Invoices section's 50 a page); none reads at once. */
  paging?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
  };
}

/**
 * A people cell's CSV text: the names its accessor reads. The people pills
 * fold to nothing (H:4115), and a cell that folds to nothing exports nothing
 * — the file still names who.
 */
function peopleText<TRow extends { id: string }>(
  table: ReactTable<DataTableFeatures, TRow>,
  columnId: string,
  row: TRow,
): string | undefined {
  const column = table.getColumn(columnId);
  if (column?.columnDef.meta?.foldValue?.(row) !== null) return undefined;
  const value = column.accessorFn?.(row, 0);
  return typeof value === 'string' ? value : undefined;
}

/** The code a section's Export asks for: billing records are payments', the rest the patient's. */
const sectionExportCode = (section: PatientTableSection) =>
  isBillingSection(section) ? 'payment:export' : 'patient:export';

/**
 * One of the patient file's section tables (KICKOFF §6.6 Section tables;
 * H:4746–4760): the shared table in the section's content — folded columns on
 * a tablet, rows with the key column at the end on a phone, selection and the
 * bulk bar's Export (CSV, the section's export code) from `md`, the row actions,
 * the footer count, the next page on scroll and "All <records> loaded" — or the section's empty
 * state.
 */
export function PatientSectionTable<TRow extends { id: string }>({
  section,
  table,
  loading,
  countLabel,
  minWidth,
  onRowClick,
  rowTone,
  rowActions,
  paging,
}: PatientSectionTableProps<TRow>) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const access = useAppAccess();
  const K = PATIENT_TABLE_KEYS;
  const Icon = PATIENT_FILE_SECTION_ICONS[section];
  const bulkActions: DataTableBulkAction<TRow>[] = canExportRows(
    access,
    sectionExportCode(section),
  )
    ? [
        {
          id: 'export',
          label: t(K.export),
          icon: FileIcon,
          onSelect: (selected) => {
            exportTableCsv({
              table,
              rows: selected,
              fileName: `${section}.csv`,
              cell: (columnId, row) => peopleText(table, columnId, row),
            });
            notify.success(t(K.exported, { count: selected.length }));
          },
        },
      ]
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-3">
      <DataTable
        table={table}
        tableId={PATIENT_SECTION_TABLE_IDS[section]}
        label={t(PATIENT_FILE_KEYS.sections[section])}
        recordsLabel={t(K[section].records)}
        countLabel={countLabel}
        fold
        selectable
        minWidth={minWidth}
        onRowClick={onRowClick ? (row) => onRowClick(row.original) : undefined}
        getRowTone={rowTone ? (row) => rowTone(row.original) : undefined}
        rowActions={rowActions ? (row) => rowActions(row.original) : undefined}
        bulkActions={bulkActions}
        hasNextPage={paging?.hasNextPage}
        isFetchingNextPage={paging?.isFetchingNextPage}
        fetchNextPage={paging?.fetchNextPage}
        empty={
          <RoomTableEmpty
            loading={loading}
            filtered={false}
            onClearFilters={() => undefined}
            tone={PATIENT_FILE_SECTION_TONES[section]}
            icon={<Icon />}
            title={t(K[section].empty)}
            description=""
            label={t(PATIENT_FILE_KEYS.sections[section])}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
    </div>
  );
}
