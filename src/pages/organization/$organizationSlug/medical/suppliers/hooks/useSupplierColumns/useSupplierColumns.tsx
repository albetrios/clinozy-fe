import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { MoneyCell, PersonChip, TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { MakerPills } from '../../../shared/components/MedicalCells/index.ts';
import type { SupplierRow } from '../../../shared/medical-contracts.ts';
import { supplierAgeingTone } from '../../../shared/medical-tones.ts';

const rowOf = (original: unknown) => original as SupplierRow;

/**
 * The Suppliers columns (KICKOFF §6.7 Tables; `medical.md:77–84`): Supplier ·
 * Manufacturers · Orders · Payable · Ageing — the server's figures, money in
 * rupees — tracks `minmax(220px,1.4fr)
 * minmax(180px,1.2fr) 100px 110px 120px`. On a phone the Supplier leads, the
 * Payable is the key and the meta line reads Manufacturers, Orders, Ageing.
 * The column ids are the URL's sort keys.
 */
export function useSupplierColumns(): ColumnDef<DataTableFeatures, SupplierRow>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const keys = MEDICAL_KEYS.suppliers;
  const noValue = t(MEDICAL_KEYS.table.noValue);
  const orders = (supplier: SupplierRow) =>
    supplier.orderCount > 0
      ? t(keys.orders, { count: supplier.orderCount })
      : t(keys.noOrders);

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
              : t(MEDICAL_KEYS.table.addPhone)
          }
          tone="sky"
        />
      ),
      meta: { track: 'minmax(220px,1.4fr)', kind: 'person' },
    },
    {
      id: 'manufacturers',
      accessorFn: (supplier) => supplier.manufacturers.map((maker) => maker.name),
      header: t(keys.columns.manufacturers),
      enableSorting: false,
      cell: ({ row }) => <MakerPills makers={row.original.manufacturers} />,
      meta: { track: 'minmax(180px,1.2fr)', kind: 'badges' },
    },
    {
      id: 'orders',
      accessorKey: 'orderCount',
      header: t(keys.columns.orders),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {orders(row.original)}
        </span>
      ),
      meta: { track: '100px', foldValue: (original) => orders(rowOf(original)) },
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
    {
      id: 'ageing',
      accessorKey: 'ageingDays',
      header: t(keys.columns.ageing),
      enableSorting: false,
      cell: ({ row }) => {
        const days = row.original.ageingDays;
        if (days === null) return null;
        return (
          <TonePill tone={supplierAgeingTone(days)} dot>
            {t(keys.ageing, { count: days })}
          </TonePill>
        );
      },
      meta: {
        track: '120px',
        kind: 'badges',
        foldValue: (original) => {
          const days = rowOf(original).ageingDays;
          if (days === null) return null;
          return {
            value: t(keys.ageing, { count: days }),
            dotClassName: TONE_CLASSES[supplierAgeingTone(days)].fill,
          };
        },
      },
    },
  ];
}
