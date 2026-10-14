import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { MoneyCell, TextCell, TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';
import type { SupplierCreditRow } from '../../../shared/medical-contracts.ts';

const rowOf = (original: unknown) => original as SupplierCreditRow;

/** A supplier credit's state pill: Open while some of it is still to set off, then Adjusted. */
export const SUPPLIER_CREDIT_STATE_TONES = { open: 'butter', adjusted: 'sage' } as const;

/**
 * Medical › Credits' "From suppliers" columns (clinozy-be MD34): Credit (the medicine over its
 * batch) · Supplier · Packs · Amount · Adjusted (what is set off against the supplier's orders) ·
 * State · Since. Money in rupees, as the API sends it; newest first — the API's one order.
 */
export function useSupplierCreditColumns(): ColumnDef<
  DataTableFeatures,
  SupplierCreditRow
>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const dates = useMedicalDates();
  const keys = MEDICAL_KEYS.credits;
  const noValue = t(MEDICAL_KEYS.table.noValue);
  return [
    {
      id: 'credit',
      accessorKey: 'medicineName',
      header: t(keys.columns.credit),
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <TextCell
          text={row.original.medicineName}
          sub={row.original.batchNo}
          weight="medium"
        />
      ),
      meta: { track: 'minmax(220px,1.4fr)' },
    },
    {
      id: 'supplier',
      accessorKey: 'supplierName',
      header: t(keys.columns.supplier),
      enableSorting: false,
      cell: ({ row }) => <TextCell text={row.original.supplierName} />,
      meta: { track: 'minmax(160px,1fr)' },
    },
    {
      id: 'packs',
      accessorKey: 'qty',
      header: t(keys.columns.packs),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {t(keys.packs, { count: row.original.qty })}
        </span>
      ),
      meta: {
        track: '90px',
        foldValue: (original) => t(keys.packs, { count: rowOf(original).qty }),
      },
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: t(keys.columns.amount),
      enableSorting: false,
      cell: ({ row }) => (
        <MoneyCell rupees={row.original.amount} className="font-semibold" />
      ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => formatRupees(rowOf(original).amount),
      },
    },
    {
      id: 'applied',
      accessorKey: 'applied',
      header: t(keys.columns.applied),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.applied > 0 ? (
          <MoneyCell rupees={row.original.applied} />
        ) : (
          <span className="text-muted-foreground">{noValue}</span>
        ),
      meta: {
        track: '110px',
        align: 'end',
        foldValue: (original) => {
          const applied = rowOf(original).applied;
          return applied > 0 ? formatRupees(applied) : null;
        },
      },
    },
    {
      id: 'state',
      accessorKey: 'status',
      header: t(keys.columns.state),
      enableSorting: false,
      cell: ({ row }) => (
        <TonePill tone={SUPPLIER_CREDIT_STATE_TONES[row.original.status]} dot>
          {t(keys.states[row.original.status])}
        </TonePill>
      ),
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const status = rowOf(original).status;
          return {
            value: t(keys.states[status]),
            dotClassName: TONE_CLASSES[SUPPLIER_CREDIT_STATE_TONES[status]].fill,
          };
        },
      },
    },
    {
      id: 'since',
      accessorKey: 'createdAt',
      header: t(keys.columns.since),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {dates.when(row.original.createdAt)}
        </span>
      ),
      meta: {
        track: '120px',
        foldValue: (original) => dates.when(rowOf(original).createdAt),
      },
    },
  ];
}
