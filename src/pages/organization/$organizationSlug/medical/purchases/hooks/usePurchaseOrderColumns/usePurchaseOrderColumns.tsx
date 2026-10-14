import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { MoneyCell, TextCell, TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import { useMedicalDates } from '../../../shared/components/MedicalCells/index.ts';
import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import { PURCHASE_STAGE_TONES } from '../../../shared/medical-tones.ts';

const rowOf = (original: unknown) => original as PurchaseOrderRow;

/** The order's medicines, in its order: "Azelaic gel 15g, Uncap". */
const itemNames = (order: PurchaseOrderRow) =>
  order.lines.map((line) => line.medicineName).join(', ');

/**
 * The Purchases columns (KICKOFF §6.7 Tables; `medical.md:61–68`): PO ·
 * Supplier · Items · Date · Total · Stage — tracks `130px minmax(200px,1.3fr)
 * minmax(180px,1.2fr) 90px 110px 150px`. On a phone the Supplier leads, the
 * Total is the key and the meta line reads "PO #431, 1631", Items, Date and
 * Stage. The column ids are the URL's sort keys — the API sorts by PO, Date
 * and Total, so Supplier and Stage do not sort (a Standing deviation).
 */
export function usePurchaseOrderColumns(): ColumnDef<
  DataTableFeatures,
  PurchaseOrderRow
>[] {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const dates = useMedicalDates();
  const keys = MEDICAL_KEYS.purchases;
  const noValue = t(MEDICAL_KEYS.table.noValue);

  const itemsSub = (order: PurchaseOrderRow) =>
    [
      t(keys.items, { count: order.itemCount }),
      ...(order.freeCount > 0 ? [t(keys.free, { count: order.freeCount })] : []),
    ].join(' · ');
  const stageLabel = (order: PurchaseOrderRow) => t(keys.stages[order.stage]);

  return [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(keys.columns.seq),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-wrap gap-1">
          <TonePill tone="neutral" size="sm" className="tabular-nums">
            {`#${row.original.seq}`}
          </TonePill>
          <TonePill tone="neutral" size="sm" className="tabular-nums">
            {row.original.supplierBillNo ?? noValue}
          </TonePill>
        </span>
      ),
      meta: {
        track: '130px',
        // First on a phone's meta line ("PO #431, 1631"; "PO #4" without a bill), never the key.
        priority: 5,
        foldValue: (original) => {
          const order = rowOf(original);
          return order.supplierBillNo
            ? `#${order.seq}, ${order.supplierBillNo}`
            : `#${order.seq}`;
        },
      },
    },
    {
      id: 'supplier',
      accessorFn: (order) => order.supplier.name,
      header: t(keys.columns.supplier),
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <TextCell text={row.original.supplier.name} weight="medium" />,
      meta: { track: 'minmax(200px,1.3fr)', primary: true },
    },
    {
      id: 'items',
      accessorFn: itemNames,
      header: t(keys.columns.items),
      enableSorting: false,
      cell: ({ row }) => (
        <TextCell text={itemNames(row.original)} sub={itemsSub(row.original)} />
      ),
      meta: { track: 'minmax(180px,1.2fr)' },
    },
    {
      id: 'date',
      accessorKey: 'date',
      header: t(keys.columns.date),
      cell: ({ row }) => (
        <span className="truncate tabular-nums">{dates.day(row.original.date)}</span>
      ),
      meta: { track: '90px', foldValue: (original) => dates.day(rowOf(original).date) },
    },
    {
      id: 'total',
      accessorKey: 'total',
      header: t(keys.columns.total),
      cell: ({ row }) => (
        <MoneyCell rupees={row.original.total} className="font-semibold" />
      ),
      meta: {
        track: '110px',
        align: 'end',
        // The phone row's key (`medical.md:68`).
        priority: 1,
        foldValue: (original) => formatRupees(rowOf(original).total),
      },
    },
    {
      id: 'stage',
      accessorKey: 'stage',
      header: t(keys.columns.stage),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;
        const partPaid = order.stage === 'received' && order.paid > 0;
        return (
          <span className="flex min-w-0 flex-wrap gap-1">
            <TonePill tone={PURCHASE_STAGE_TONES[order.stage]} dot>
              {stageLabel(order)}
            </TonePill>
            {partPaid ? (
              <TonePill tone="neutral" className="tabular-nums">
                {t(keys.partPaid, { amount: formatRupees(order.paid) })}
              </TonePill>
            ) : null}
          </span>
        );
      },
      meta: {
        track: '150px',
        kind: 'badges',
        foldValue: (original) => {
          const order = rowOf(original);
          return {
            value: stageLabel(order),
            dotClassName: TONE_CLASSES[PURCHASE_STAGE_TONES[order.stage]].fill,
          };
        },
      },
    },
  ];
}
