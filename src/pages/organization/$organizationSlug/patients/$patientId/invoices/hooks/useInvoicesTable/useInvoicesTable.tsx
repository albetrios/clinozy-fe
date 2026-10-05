import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { PatientInvoiceRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  INVOICE_STATUS_TONES,
  INVOICE_TYPE_TONES,
  TONE_CLASSES,
} from '@/shared/clinic/clinic-tones.ts';
import { IdPill, MoneyCell, TonePill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  TeamCell,
  useTableDay,
} from '../../../shared/components/PatientSectionTable/index.ts';
import {
  type StaffChip,
  useStaffLookup,
} from '../../../shared/hooks/useStaffLookup/index.ts';

const keys = PATIENT_TABLE_KEYS;
const rowOf = (original: unknown) => original as PatientInvoiceRow;

/**
 * The Invoices columns (KICKOFF §6.6 Section tables; H:4748): Invoice ("#787"
 * and its type) · Items (the names over the remark, or "1 item") · Team
 * (hidden) · Bill · Paid / due · Status · Date, 1120px in all. On a phone
 * Items leads, Bill is the key and Paid / due, the invoice, the status and
 * the date fold under it.
 */
function useInvoicesColumns(): ColumnDef<DataTableFeatures, PatientInvoiceRow>[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const day = useTableDay();
  const staff = useStaffLookup();
  const formatPaise = usePaiseFormat();
  const type = (invoice: PatientInvoiceRow) =>
    tClinic(CLINIC_KEYS.invoiceTypes[invoice.type]);
  const status = (invoice: PatientInvoiceRow) =>
    tClinic(CLINIC_KEYS.invoiceStatuses[invoice.status]);
  const items = (invoice: PatientInvoiceRow) => invoice.items.join(', ');
  const team = (invoice: PatientInvoiceRow) =>
    invoice.teamIds
      .map((id) => staff(id))
      .filter((person): person is StaffChip => person !== null);

  return [
    {
      id: 'invoice',
      accessorFn: (row) => displayId.invoiceNumber(row.seq),
      header: t(keys.columns.invoice),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <IdPill>{displayId.invoiceNumber(row.original.seq)}</IdPill>
          <TonePill tone={INVOICE_TYPE_TONES[row.original.type]} className="truncate">
            {type(row.original)}
          </TonePill>
        </span>
      ),
      meta: {
        track: '150px',
        kind: 'badges',
        foldValue: (original) => ({
          value: `${displayId.invoiceNumber(rowOf(original).seq)}, ${type(rowOf(original))}`,
          dotClassName: TONE_CLASSES[INVOICE_TYPE_TONES[rowOf(original).type]].fill,
        }),
      },
    },
    {
      id: 'items',
      accessorFn: items,
      header: t(keys.columns.items),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="text-body truncate">{items(row.original)}</span>
          <span className="text-caption text-muted-foreground truncate">
            {row.original.remark ??
              t(keys.invoices.itemCount, { count: row.original.items.length })}
          </span>
        </span>
      ),
      meta: { track: 'minmax(200px,1.5fr)', primary: true },
    },
    {
      id: 'team',
      accessorFn: (row) =>
        team(row)
          .map((person) => person.name)
          .join(', '),
      header: t(keys.columns.team),
      enableSorting: false,
      cell: ({ row }) => <TeamCell people={team(row.original)} />,
      meta: { track: '90px', defaultHidden: true, foldValue: () => null },
    },
    {
      id: 'bill',
      accessorFn: (row) => formatPaise(row.bill),
      header: t(keys.columns.bill),
      enableSorting: false,
      cell: ({ row }) => (
        <MoneyCell paise={row.original.bill} className="font-semibold" />
      ),
      meta: { track: '100px', align: 'end' },
    },
    {
      id: 'paid',
      accessorFn: (row) => formatPaise(row.paid),
      header: t(keys.columns.paid),
      enableSorting: false,
      cell: ({ row }) => {
        const { paid, due } = row.original;
        return (
          <span className="flex min-w-0 flex-col items-end">
            <MoneyCell paise={paid} />
            <span
              className={cn(
                'text-caption truncate',
                due > 0 ? 'text-tone-blush-foreground' : 'text-tone-sage-foreground',
              )}
            >
              {due > 0
                ? t(keys.invoices.due, { amount: formatPaise(due) })
                : t(keys.invoices.nothingDue)}
            </span>
          </span>
        );
      },
      meta: { track: '130px', align: 'end' },
    },
    {
      id: 'status',
      accessorFn: status,
      header: t(keys.columns.status),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={INVOICE_STATUS_TONES[row.original.status]} dot>
          {status(row.original)}
        </TonePill>
      ),
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => ({
          value: status(rowOf(original)),
          dotClassName: TONE_CLASSES[INVOICE_STATUS_TONES[rowOf(original).status]].fill,
        }),
      },
    },
    {
      id: 'date',
      accessorFn: (row) => day(row.date, true),
      header: t(keys.columns.date),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body truncate tabular-nums">
          {day(row.original.date, true)}
        </span>
      ),
      meta: { track: '90px' },
    },
  ];
}

/** The Invoices table: the patient's invoices, newest first; the Columns choice is a device pref. */
export function useInvoicesTable(rows: readonly PatientInvoiceRow[]) {
  const columns = useInvoicesColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.invoices, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as PatientInvoiceRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
