import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_MODE_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { IdPill, TonePill } from '@/shared/components/Cells/index.ts';
import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import {
  EmptyCell,
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  StaffCell,
} from '../../../shared/components/PatientSectionTable/index.ts';

const keys = PATIENT_TABLE_KEYS;
const rowOf = (original: unknown) => original as LedgerRow;

/**
 * The Payments columns (KICKOFF §6.6 Section tables; H:4751): Receipt
 * ("PAY-5600", the schema's prefix — D32) · When · Invoice · Mode · Amount
 * ("+ ₹2,000" sage, "− ₹500" blush — the entry's rupees as the API sends them) ·
 * By (who recorded it, from the team), 760px in all. On a phone When leads,
 * Amount is the key and the mode, receipt and invoice fold under it; the
 * recorder's pill folds to nothing (H:4115).
 */
function usePatientPaymentsColumns(): ColumnDef<DataTableFeatures, LedgerRow>[] {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const clock = useAppClock();
  const formatRupees = useRupeeFormat();
  // "Cash + UPI" — each split's mode once, as the ledger's Mode pill joins them.
  const modes = (row: LedgerRow) => [...new Set(row.splits.map((split) => split.mode))];
  const modeLabel = (row: LedgerRow) =>
    modes(row)
      .map((mode) => tApp(APP_KEYS.paymentModes[mode]))
      .join(' + ');
  const modeTone = (row: LedgerRow) => {
    const [first] = modes(row);
    return first ? PAYMENT_MODE_TONES[first] : 'stone';
  };
  const amount = (row: LedgerRow) =>
    t(row.direction === 'received' ? keys.payments.received : keys.payments.paid, {
      amount: formatRupees(row.amount),
    });

  return [
    {
      id: 'receipt',
      accessorFn: (row) => displayId.payment(row.seq),
      header: t(keys.columns.receipt),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <IdPill>{displayId.payment(row.original.seq)}</IdPill>,
      meta: { track: '110px', kind: 'id' },
    },
    {
      id: 'when',
      accessorFn: (row) => clock.moment(row.paidAt),
      header: t(keys.columns.when),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-body truncate tabular-nums">
          {clock.moment(row.original.paidAt)}
        </span>
      ),
      meta: { track: '150px', primary: true },
    },
    {
      id: 'invoice',
      accessorFn: (row) => (row.invoice ? displayId.invoiceNumber(row.invoice.seq) : ''),
      header: t(keys.columns.invoice),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.invoice ? (
          <IdPill>{displayId.invoiceNumber(row.original.invoice.seq)}</IdPill>
        ) : (
          <EmptyCell />
        ),
      meta: {
        track: '110px',
        kind: 'id',
        foldValue: (original) => {
          const { invoice } = rowOf(original);
          return invoice ? displayId.invoiceNumber(invoice.seq) : null;
        },
      },
    },
    {
      id: 'mode',
      accessorFn: modeLabel,
      header: t(keys.columns.mode),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={modeTone(row.original)} className="truncate">
          {modeLabel(row.original)}
        </TonePill>
      ),
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => ({
          value: modeLabel(rowOf(original)),
          dotClassName: TONE_CLASSES[modeTone(rowOf(original))].fill,
        }),
      },
    },
    {
      id: 'amount',
      accessorFn: amount,
      header: t(keys.columns.amount),
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className={cn(
            'text-body font-semibold whitespace-nowrap tabular-nums',
            row.original.direction === 'received'
              ? 'text-tone-sage-foreground'
              : 'text-tone-blush-foreground',
          )}
        >
          {amount(row.original)}
        </span>
      ),
      meta: { track: '120px', align: 'end' },
    },
    {
      id: 'by',
      accessorFn: (row) => row.by?.name ?? '',
      header: t(keys.columns.by),
      enableSorting: false,
      cell: ({ row }) => <StaffCell person={row.original.by} />,
      // The 28px people pill folds to nothing (H:4115).
      meta: { track: 'minmax(140px,1fr)', foldValue: () => null },
    },
  ];
}

/** The Payments table: the patient's receipts and refunds, newest first; Columns is a device pref. */
export function usePatientPaymentsTable(rows: readonly LedgerRow[]) {
  const columns = usePatientPaymentsColumns();
  const visibility = useHiddenColumns(PATIENT_SECTION_TABLE_IDS.payments, columns);
  return useTable({
    features: dataTableFeatures,
    data: rows as LedgerRow[],
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
}
