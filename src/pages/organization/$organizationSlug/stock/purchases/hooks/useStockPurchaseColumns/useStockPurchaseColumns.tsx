import type { ColumnDef } from '@tanstack/react-table';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  IdPill,
  MoneyCell,
  PersonChip,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { useStockWords } from '../../../shared/hooks/useStockWords/index.ts';
import type { StockPurchaseRow } from '../../../shared/stock-contracts.ts';
import { STOCK_KEYS } from '../../../stock.constants.ts';

const rowOf = (original: unknown) => original as StockPurchaseRow;

/**
 * The Purchases columns (KICKOFF §6.8 Tables; `clinic-stock.md:45–47`): ID ·
 * Supplier · Invoice (hidden) · Date · Bill · Due · Status — tracks `60px
 * minmax(200px,1.4fr) 120px 110px 110px 110px 110px`. The bill, what is due and
 * the status are clinozy-be's, in rupees. On a phone the Supplier leads, the
 * Bill is the key and the meta line reads Due, Date, Status and the ID ("—"
 * dues skipped). The column ids are the URL's sort keys: ID, Bill and Due —
 * the API does not sort by supplier.
 */
export function useStockPurchaseColumns(): ColumnDef<
  DataTableFeatures,
  StockPurchaseRow
>[] {
  const words = useStockWords();
  const { t, formatRupees } = words;
  const keys = STOCK_KEYS.purchases;
  const noValue = t(STOCK_KEYS.table.noValue);
  return [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(keys.columns.seq),
      enableHiding: false,
      cell: ({ row }) => <IdPill>{displayId.stockPurchase(row.original.seq)}</IdPill>,
      meta: {
        track: '60px',
        kind: 'id',
        foldValue: (original) => displayId.stockPurchase(rowOf(original).seq),
      },
    },
    {
      id: 'vendor',
      accessorFn: (purchase) => purchase.vendor?.name ?? '',
      header: t(keys.columns.vendor),
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const vendor = row.original.vendor;
        return (
          <PersonChip
            name={vendor?.name ?? noValue}
            sub={vendor?.phone ? formatClinicPhone(vendor.phone) : undefined}
            tone="sky"
          />
        );
      },
      meta: { track: 'minmax(200px,1.4fr)', kind: 'person' },
    },
    {
      id: 'billNo',
      accessorKey: 'billNo',
      header: t(keys.columns.billNo),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.billNo ? <IdPill>{row.original.billNo}</IdPill> : null,
      meta: {
        track: '120px',
        kind: 'id',
        defaultHidden: true,
        foldValue: (original) => rowOf(original).billNo,
      },
    },
    {
      id: 'date',
      accessorKey: 'date',
      header: t(keys.columns.date),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate tabular-nums">
          {words.billDate(row.original.date)}
        </span>
      ),
      meta: {
        track: '110px',
        foldValue: (original) => words.billDate(rowOf(original).date),
      },
    },
    {
      id: 'bill',
      accessorKey: 'bill',
      header: t(keys.columns.bill),
      cell: ({ row }) => (
        <MoneyCell rupees={row.original.bill} className="font-semibold" />
      ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => formatRupees(rowOf(original).bill),
      },
    },
    {
      id: 'due',
      accessorKey: 'due',
      header: t(keys.columns.due),
      cell: ({ row }) =>
        row.original.due > 0 ? (
          <MoneyCell
            rupees={row.original.due}
            className="text-tone-blush-foreground font-semibold"
          />
        ) : (
          <span className="text-muted-foreground">{noValue}</span>
        ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => {
          const due = rowOf(original).due;
          return due > 0 ? formatRupees(due) : noValue;
        },
      },
    },
    {
      id: 'status',
      accessorFn: (purchase) => words.status(purchase.status).label,
      header: t(keys.columns.status),
      enableSorting: false,
      cell: ({ row }) => {
        const status = words.status(row.original.status);
        return (
          <TonePill tone={status.tone ?? 'neutral'} dot>
            {status.label}
          </TonePill>
        );
      },
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const status = words.status(rowOf(original).status);
          return {
            value: status.label,
            dotClassName: status.tone ? TONE_CLASSES[status.tone].fill : undefined,
          };
        },
      },
    },
  ];
}
