import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  INVOICE_STATUS_TONES,
  INVOICE_TYPE_TONES,
  TONE_CLASSES,
} from '@/shared/app/app-tones.ts';
import { IdPill, MoneyCell, TonePill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

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
const rowOf = (original: unknown) => original as InvoiceRecord;

/**
 * The Invoices columns (KICKOFF §6.6 Section tables; H:4748): Invoice ("#787"
 * and its type) · Items (the billed names over the remark, or "1 item") · Team
 * (hidden) · Bill · Paid / due · Status · Date, 1120px in all — every figure
 * the server's, in rupees (`total`, `paid_amount`, `due_amount`,
 * `payment_status`). On a phone Items leads, Bill is the key and Paid / due,
 * the invoice, the status and the date fold under it.
 */
function useInvoicesColumns(): ColumnDef<DataTableFeatures, InvoiceRecord>[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const day = useTableDay();
  const staff = useStaffLookup();
  const formatRupees = useRupeeFormat();
  const type = (invoice: InvoiceRecord) => tApp(APP_KEYS.invoiceTypes[invoice.type]);
  const status = (invoice: InvoiceRecord) =>
    tApp(APP_KEYS.invoiceStatuses[invoice.status]);
  const items = (invoice: InvoiceRecord) =>
    invoice.items.map((line) => line.name).join(', ');
  const team = (invoice: InvoiceRecord) =>
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
      accessorFn: (row) => formatRupees(row.total),
      header: t(keys.columns.bill),
      enableSorting: false,
      cell: ({ row }) => (
        <MoneyCell rupees={row.original.total} className="font-semibold" />
      ),
      meta: { track: '100px', align: 'end' },
    },
    {
      id: 'paid',
      accessorFn: (row) => formatRupees(row.paid),
      header: t(keys.columns.paid),
      enableSorting: false,
      cell: ({ row }) => {
        const { paid, due } = row.original;
        return (
          <span className="flex min-w-0 flex-col items-end">
            <MoneyCell rupees={paid} />
            <span
              className={cn(
                'text-caption truncate',
                due > 0 ? 'text-tone-blush-foreground' : 'text-tone-sage-foreground',
              )}
            >
              {due > 0
                ? t(keys.invoices.due, { amount: formatRupees(due) })
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
export function useInvoicesTable(rows: readonly InvoiceRecord[]) {
  const columns = useInvoicesColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.invoices, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as InvoiceRecord[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
