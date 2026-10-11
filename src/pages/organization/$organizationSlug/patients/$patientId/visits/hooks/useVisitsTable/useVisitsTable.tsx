import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { APPOINTMENT_STATUS_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { serviceTone } from '@/shared/app/appointment-display.ts';
import { IdPill, TonePill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';

import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  StaffCell,
} from '../../../shared/components/PatientSectionTable/index.ts';

const keys = PATIENT_TABLE_KEYS;
const rowOf = (original: unknown) => original as AppointmentRow;

/**
 * The Visits columns (KICKOFF §6.6 Section tables; H:4746): ID · When ·
 * Offering · Doctor · Status, on the prototype's tracks (760px in all). On a
 * phone When leads, Offering is the key and the status and number fold under
 * it; the doctor's chip folds to nothing (H:4115).
 */
function useVisitsColumns(): ColumnDef<DataTableFeatures, AppointmentRow>[] {
  const { t } = useTranslation([PATIENT_TABLE_NS, APP_NS]);
  const slot = useAppointmentSlotLabel();
  const when = (row: AppointmentRow) => {
    const label = slot(row.date, row.startTime);
    return `${label.day} · ${label.time}`;
  };
  const status = (row: AppointmentRow) =>
    t(APP_KEYS.appointments.statuses[row.status], { ns: APP_NS });
  return [
    {
      id: 'id',
      accessorKey: 'seq',
      header: t(keys.columns.id),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <IdPill>{displayId.appointment(row.original.seq)}</IdPill>,
      meta: {
        track: '80px',
        kind: 'id',
        foldValue: (original) => displayId.appointment(rowOf(original).seq),
      },
    },
    {
      id: 'when',
      accessorFn: when,
      header: t(keys.columns.when),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body truncate font-medium">{when(row.original)}</span>
      ),
      meta: { track: '180px', primary: true },
    },
    {
      id: 'offering',
      accessorKey: 'serviceLabel',
      header: t(keys.columns.offering),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={serviceTone(row.original)} className="max-w-full truncate">
          {row.original.serviceLabel}
        </TonePill>
      ),
      meta: { track: 'minmax(160px,1fr)', kind: 'badges' },
    },
    {
      id: 'doctor',
      accessorFn: (row) => row.doctor?.name ?? '',
      header: t(keys.columns.doctor),
      enableSorting: false,
      cell: ({ row }) => {
        const { doctor } = row.original;
        return (
          <StaffCell
            person={
              doctor
                ? {
                    id: doctor.id,
                    name: doctor.name,
                    initials: doctor.initials,
                    tone: doctor.tone,
                  }
                : null
            }
          />
        );
      },
      // The 28px people pill folds to nothing (H:4115).
      meta: { track: '180px', foldValue: () => null },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: t(keys.columns.status),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={APPOINTMENT_STATUS_TONES[row.original.status]} dot>
          {status(row.original)}
        </TonePill>
      ),
      meta: {
        track: '130px',
        kind: 'badges',
        foldValue: (original) => ({
          value: status(rowOf(original)),
          dotClassName:
            TONE_CLASSES[APPOINTMENT_STATUS_TONES[rowOf(original).status]].fill,
        }),
      },
    },
  ];
}

/** The Visits table: the patient's bookings, newest first; the Columns choice is a device pref. */
export function useVisitsTable(rows: readonly AppointmentRow[]) {
  const columns = useVisitsColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.visits, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as AppointmentRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
