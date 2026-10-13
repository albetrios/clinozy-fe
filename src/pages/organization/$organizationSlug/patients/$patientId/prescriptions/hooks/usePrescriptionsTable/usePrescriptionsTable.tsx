import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { IdPill, TonePill } from '@/shared/components/Cells/index.ts';
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
  UpdatedCell,
  useTableDay,
} from '../../../shared/components/PatientSectionTable/index.ts';
import { useStaffLookup } from '../../../shared/hooks/useStaffLookup/index.ts';
import { rxFormLineOf, useRxLabels } from '../../components/PrescriptionDrawer/index.ts';
import { RX_KEYS, RX_STATUS_TONES } from '../../prescriptions.constants.ts';

const keys = PATIENT_TABLE_KEYS;
const rowOf = (original: unknown) => original as PrescriptionRecord;

/** "Flubolt 400, Clonix-B Lotion" — the medicines' names. */
const medicineNames = (prescription: PrescriptionRecord) =>
  prescription.items.map((item) => item.medicineName).join(', ');

/** "Doctor's advice · Today's procedure", the notes the Rx carries. */
const prescriptionNotes = (prescription: PrescriptionRecord) =>
  [prescription.advice, prescription.procedureToday].filter(Boolean).join(' · ');

/**
 * The Prescriptions columns (KICKOFF §6.6 Section tables; H:4753): ID · Date
 * · Medicines (the names over "0-0-1 · After meal | Morning & night") · Notes
 * (hidden) · Doctor · Status (Draft · Approved, Q19) · Updated (hidden; when
 * only — the API names no author, G4), 1100px in all. On a phone Date leads,
 * Medicines is the key and the number and status fold under it; the doctor's
 * pill folds to nothing (H:4115).
 */
function usePrescriptionsColumns(): ColumnDef<DataTableFeatures, PrescriptionRecord>[] {
  // The section tables and the Rx copy share the patient file's namespace.
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const status = (prescription: PrescriptionRecord) =>
    t(RX_KEYS.status[prescription.status]);
  const day = useTableDay();
  const staff = useStaffLookup();
  const labels = useRxLabels();
  const directions = (prescription: PrescriptionRecord) =>
    prescription.items
      .map((item) => {
        const line = rxFormLineOf(item);
        return [labels.dose(line.dose), labels.when(line.when)]
          .filter(Boolean)
          .join(' · ');
      })
      .filter(Boolean)
      .join(' | ');
  return [
    {
      id: 'id',
      accessorKey: 'seq',
      header: t(keys.columns.id),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <IdPill>{displayId.prescription(row.original.seq)}</IdPill>,
      meta: {
        track: '70px',
        kind: 'id',
        foldValue: (original) => displayId.prescription(rowOf(original).seq),
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
      meta: { track: '110px', primary: true },
    },
    {
      id: 'medicines',
      accessorFn: medicineNames,
      header: t(keys.columns.medicines),
      enableSorting: false,
      cell: ({ row }) => {
        const sub = directions(row.original);
        return (
          <span className="flex min-w-0 flex-col">
            <span className="text-body truncate">{medicineNames(row.original)}</span>
            {sub ? (
              <span className="text-caption text-muted-foreground truncate">{sub}</span>
            ) : null}
          </span>
        );
      },
      meta: { track: 'minmax(240px,2fr)' },
    },
    {
      id: 'notes',
      accessorFn: (row) => prescriptionNotes(row) || '—',
      header: t(keys.columns.notes),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body text-muted-foreground-strong truncate">
          {prescriptionNotes(row.original) || '—'}
        </span>
      ),
      meta: { track: 'minmax(140px,1fr)', defaultHidden: true },
    },
    {
      id: 'doctor',
      accessorFn: (row) => staff(row.doctorId)?.name ?? '',
      header: t(keys.columns.doctor),
      enableSorting: false,
      cell: ({ row }) => <StaffCell person={staff(row.original.doctorId)} />,
      // The 28px people pill folds to nothing (H:4115).
      meta: { track: 'minmax(120px,.8fr)', foldValue: () => null },
    },
    {
      id: 'status',
      accessorFn: status,
      header: t(keys.columns.status),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={RX_STATUS_TONES[row.original.status]} dot>
          {status(row.original)}
        </TonePill>
      ),
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => ({
          value: status(rowOf(original)),
          dotClassName: TONE_CLASSES[RX_STATUS_TONES[rowOf(original).status]].fill,
        }),
      },
    },
    {
      id: 'updated',
      accessorKey: 'updatedAt',
      header: t(keys.columns.updated),
      enableSorting: false,
      cell: ({ row }) => <UpdatedCell person={null} at={row.original.updatedAt} />,
      meta: { track: '150px', defaultHidden: true, foldValue: () => null },
    },
  ];
}

/** The Prescriptions table: the patient's prescriptions, newest first; Columns is a device pref. */
export function usePrescriptionsTable(rows: readonly PrescriptionRecord[]) {
  const columns = usePrescriptionsColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.prescriptions, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as PrescriptionRecord[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
