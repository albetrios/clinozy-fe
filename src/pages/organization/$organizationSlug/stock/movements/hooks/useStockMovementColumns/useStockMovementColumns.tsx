import type { ColumnDef } from '@tanstack/react-table';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { AvatarStack, TextCell, TonePill } from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { useStockWords } from '../../../shared/hooks/useStockWords/index.ts';
import type { StockMovementRow } from '../../../shared/stock-contracts.ts';
import { STOCK_KEYS } from '../../../stock.constants.ts';

const rowOf = (original: unknown) => original as StockMovementRow;

/** A reverted stock change — struck through in grey (`clinic-stock.md:61`). */
const isReverted = (row: StockMovementRow) => row.kind !== 'payment' && row.reverted;

/**
 * The Movements columns (KICKOFF §6.8 Tables; `clinic-stock.md:61–63`): Type ·
 * Item / party · When · By · Change — tracks `130px minmax(240px,1.8fr) 130px
 * 120px 130px`; nothing sorts, newest first. On a phone the Item / party
 * leads, the Change is the key and the meta line reads the Type and When.
 */
export function useStockMovementColumns(): ColumnDef<
  DataTableFeatures,
  StockMovementRow
>[] {
  const words = useStockWords();
  const { t } = words;
  const keys = STOCK_KEYS.movements;

  /** The party line and its note: the item, or the purchase a payment settles. */
  const party = (row: StockMovementRow) => {
    if (row.kind !== 'payment') return { name: row.item.name, sub: row.note };
    const purchase = t(keys.purchase, { seq: row.purchase.seq });
    return {
      name: row.vendorName,
      sub: row.purchase.billNo
        ? t(keys.paymentSub, { purchase, billNo: row.purchase.billNo })
        : purchase,
    };
  };
  const when = (row: StockMovementRow) =>
    row.kind === 'payment' ? words.day(row.date) : words.when(row.at);

  return [
    {
      id: 'type',
      accessorFn: (row) => words.movementType(row.kind).label,
      header: t(keys.columns.type),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const type = words.movementType(row.original.kind);
        return (
          <span className="flex min-w-0 flex-wrap gap-1">
            <TonePill tone={type.tone ?? 'neutral'}>{type.label}</TonePill>
            {isReverted(row.original) ? (
              <TonePill tone="neutral">{t(keys.reverted)}</TonePill>
            ) : null}
          </span>
        );
      },
      meta: {
        track: '130px',
        kind: 'badges',
        foldValue: (original) => {
          const type = words.movementType(rowOf(original).kind);
          return {
            value: type.label,
            dotClassName: type.tone ? TONE_CLASSES[type.tone].fill : undefined,
          };
        },
      },
    },
    {
      id: 'party',
      accessorFn: (row) => party(row).name,
      header: t(keys.columns.party),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const line = party(row.original);
        return <TextCell text={line.name} weight="medium" sub={line.sub ?? undefined} />;
      },
      meta: { track: 'minmax(240px,1.8fr)', primary: true },
    },
    {
      id: 'when',
      accessorFn: (row) => when(row),
      header: t(keys.columns.when),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground-strong truncate">
          {when(row.original)}
        </span>
      ),
      meta: { track: '130px' },
    },
    {
      id: 'by',
      accessorFn: (row) => row.by?.name ?? '',
      header: t(keys.columns.by),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.by ? (
          <AvatarStack
            people={[
              {
                id: row.original.by.id,
                name: row.original.by.name,
                initials: row.original.by.initials,
                tone: row.original.by.tone,
              },
            ]}
            nameFirst
          />
        ) : null,
      meta: {
        track: '120px',
        // The phone meta line reads the Type and When only (`clinic-stock.md:68`).
        foldValue: (original) => {
          const by = rowOf(original).by;
          return by ? { value: by.name, quiet: true } : null;
        },
      },
    },
    {
      id: 'change',
      accessorFn: (row) => words.change(row),
      header: t(keys.columns.change),
      enableSorting: false,
      cell: ({ row }) => {
        const type = words.movementType(row.original.kind);
        return (
          <span
            className={cn(
              'truncate font-semibold tabular-nums',
              isReverted(row.original) || !type.tone
                ? 'text-muted-foreground'
                : TONE_CLASSES[type.tone].ink,
            )}
          >
            {words.change(row.original)}
          </span>
        );
      },
      meta: {
        track: '130px',
        align: 'end',
        foldValue: (original) => words.change(rowOf(original)),
      },
    },
  ];
}
