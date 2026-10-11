import type { ColumnDef } from '@tanstack/react-table';

import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { MoneyCell, PersonChip } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { useStockWords } from '../../../shared/hooks/useStockWords/index.ts';
import type { StockVendorRow } from '../../../shared/stock-contracts.ts';
import { STOCK_KEYS } from '../../../stock.constants.ts';

const rowOf = (original: unknown) => original as StockVendorRow;

/**
 * The Vendors columns (Q-K1; KICKOFF §6.8 Tables), modelled on Medical ›
 * Suppliers: Vendor · Purchases · Payable — tracks `minmax(220px,1.4fr) 120px
 * 110px`. Purchases is the server's count of their live purchases, Payable the
 * server's rupees owed on them; Vendor and Payable sort (`sort=name`,
 * `sort=payable`), Purchases does not. On a phone the Vendor leads, the Payable
 * is the key and the meta line reads the Purchases. AMBER: the labels are not
 * in the source. The column ids are the URL's sort keys.
 */
export function useStockVendorColumns(): ColumnDef<DataTableFeatures, StockVendorRow>[] {
  const { t, formatRupees } = useStockWords();
  const keys = STOCK_KEYS.vendors;
  const noValue = t(STOCK_KEYS.table.noValue);
  const purchases = (vendor: StockVendorRow) =>
    vendor.purchaseCount > 0
      ? t(keys.purchases, { count: vendor.purchaseCount })
      : t(keys.noPurchases);

  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: t(keys.columns.name),
      enableHiding: false,
      cell: ({ row }) => (
        <PersonChip
          name={row.original.name}
          sub={
            row.original.phone
              ? formatAppPhone(row.original.phone)
              : t(STOCK_KEYS.table.addPhone)
          }
          tone="sky"
        />
      ),
      meta: { track: 'minmax(220px,1.4fr)', kind: 'person' },
    },
    {
      id: 'purchases',
      accessorKey: 'purchaseCount',
      header: t(keys.columns.purchases),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {purchases(row.original)}
        </span>
      ),
      meta: { track: '120px', foldValue: (original) => purchases(rowOf(original)) },
    },
    {
      id: 'payable',
      accessorKey: 'payable',
      header: t(keys.columns.payable),
      cell: ({ row }) =>
        row.original.payable > 0 ? (
          <MoneyCell
            rupees={row.original.payable}
            className="text-tone-blush-foreground font-semibold"
          />
        ) : (
          <span className="text-muted-foreground">{noValue}</span>
        ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => {
          const payable = rowOf(original).payable;
          return payable > 0 ? formatRupees(payable) : noValue;
        },
      },
    },
  ];
}
