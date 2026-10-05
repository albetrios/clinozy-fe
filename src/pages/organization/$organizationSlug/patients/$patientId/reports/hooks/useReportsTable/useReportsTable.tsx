import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import type { PatientReport } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  StaffCell,
  useTableDay,
} from '../../../shared/components/PatientSectionTable/index.ts';
import { useStaffLookup } from '../../../shared/hooks/useStaffLookup/index.ts';
import { reportFileFormat } from '../../report-file.ts';
import { REPORT_KEYS, REPORT_TYPE_TONES } from '../../reports.constants.ts';

const keys = PATIENT_TABLE_KEYS;
const rowOf = (original: unknown) => original as PatientReport;

/**
 * The Reports columns (KICKOFF §6.6 Section tables; H:4760): Report (the
 * name over "PDF · shared with patient on request") · Type · Date · Uploaded
 * by, 760px in all. On a phone Report leads, Type is the key and the date
 * folds under it; the uploader's pill folds to nothing (H:4115).
 */
function useReportsColumns(): ColumnDef<DataTableFeatures, PatientReport>[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const day = useTableDay();
  const staff = useStaffLookup();
  const type = (report: PatientReport) => t(REPORT_KEYS.types[report.type]);
  // As the Report view words it: a report with no file yet reads as drawn.
  const fileLine = (report: PatientReport) =>
    t(keys.reports.fileSub, { format: reportFileFormat(report.files) });
  return [
    {
      id: 'report',
      accessorKey: 'name',
      header: t(keys.columns.report),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="text-body truncate font-medium">{row.original.name}</span>
          <span className="text-caption text-muted-foreground truncate">
            {fileLine(row.original)}
          </span>
        </span>
      ),
      meta: { track: 'minmax(220px,2fr)', primary: true },
    },
    {
      id: 'type',
      accessorFn: type,
      header: t(keys.columns.type),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={REPORT_TYPE_TONES[row.original.type]}>
          {type(row.original)}
        </TonePill>
      ),
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => ({
          value: type(rowOf(original)),
          dotClassName: TONE_CLASSES[REPORT_TYPE_TONES[rowOf(original).type]].fill,
        }),
      },
    },
    {
      id: 'date',
      accessorFn: (row) => day(row.date),
      header: t(keys.columns.date),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body truncate tabular-nums">{day(row.original.date)}</span>
      ),
      meta: { track: '130px' },
    },
    {
      id: 'uploadedBy',
      accessorFn: (row) => staff(row.createdById)?.name ?? '',
      header: t(keys.columns.uploadedBy),
      enableSorting: false,
      cell: ({ row }) => <StaffCell person={staff(row.original.createdById)} />,
      // The 28px people pill folds to nothing (H:4115).
      meta: { track: '180px', foldValue: () => null },
    },
  ];
}

/** The Reports table: the patient's reports, newest first; the Columns choice is a device pref. */
export function useReportsTable(rows: readonly PatientReport[]) {
  const columns = useReportsColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.reports, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as PatientReport[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
