import type { ColumnDef } from '@tanstack/react-table';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  IdPill,
  PersonChip,
  StockBarCell,
  TextCell,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { useStockWords } from '../../../shared/hooks/useStockWords/index.ts';
import type { StockItemRow } from '../../../shared/stock-contracts.ts';
import { stockBarPercent } from '../../../shared/stock-units.ts';
import { STOCK_KEYS } from '../../../stock.constants.ts';

const rowOf = (original: unknown) => original as StockItemRow;

/**
 * The Items columns (KICKOFF §6.8 Tables; `clinic-stock.md:29–31`): ID · Item ·
 * Category · Stock · Lasts · Supplier (hidden) — tracks `60px
 * minmax(200px,1.5fr) 150px 170px 110px minmax(150px,1fr)`. On a phone the
 * Item leads, the Category pill is the key and the meta line reads Stock,
 * Lasts and the ID; at 820 Item and Category stay. The column ids are the
 * URL's sort keys.
 */
export function useStockItemColumns(): ColumnDef<DataTableFeatures, StockItemRow>[] {
  const words = useStockWords();
  const { t } = words;
  const keys = STOCK_KEYS.items;
  return [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(keys.columns.seq),
      enableHiding: false,
      cell: ({ row }) => <IdPill>{displayId.stockItem(row.original.seq)}</IdPill>,
      meta: {
        track: '60px',
        kind: 'id',
        foldValue: (original) => displayId.stockItem(rowOf(original).seq),
      },
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: t(keys.columns.name),
      enableHiding: false,
      cell: ({ row }) => (
        <TextCell
          text={row.original.name}
          weight="medium"
          sub={words.itemSub(row.original)}
        />
      ),
      meta: { track: 'minmax(200px,1.5fr)', primary: true },
    },
    {
      id: 'category',
      accessorFn: (item) => words.category(item.category).label,
      header: t(keys.columns.category),
      cell: ({ row }) => {
        const category = words.category(row.original.category);
        return <TonePill tone={category.tone ?? 'neutral'}>{category.label}</TonePill>;
      },
      meta: {
        track: '150px',
        kind: 'badges',
        // The phone row's key, top right (`clinic-stock.md:36`).
        priority: 1,
        foldValue: (original) => {
          const category = words.category(rowOf(original).category);
          return {
            value: category.label,
            dotClassName: category.tone ? TONE_CLASSES[category.tone].fill : undefined,
          };
        },
      },
    },
    {
      id: 'stock',
      accessorKey: 'qtyMilli',
      header: t(keys.columns.stock),
      cell: ({ row }) => {
        const stock = words.stock(row.original);
        return (
          <StockBarCell
            label={stock.label}
            percent={stockBarPercent(row.original.qtyMilli, row.original.maxQty)}
            tone={stock.tone}
          />
        );
      },
      meta: {
        track: '170px',
        // A bar cell folds as plain words — the design dots badge cells only (H:4116).
        foldValue: (original) => words.stock(rowOf(original)).label,
      },
    },
    {
      id: 'lasts',
      accessorFn: (item) => words.runway(item.lastsDays).label,
      header: t(keys.columns.lasts),
      cell: ({ row }) => {
        const runway = words.runway(row.original.lastsDays);
        return (
          <TonePill tone={runway.tone ?? 'neutral'}>
            <span className="tabular-nums">{runway.label}</span>
          </TonePill>
        );
      },
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const runway = words.runway(rowOf(original).lastsDays);
          return {
            value: runway.label,
            dotClassName: runway.tone ? TONE_CLASSES[runway.tone].fill : undefined,
          };
        },
      },
    },
    {
      id: 'vendor',
      accessorFn: (item) => item.vendor?.name ?? '',
      header: t(keys.columns.vendor),
      enableSorting: false,
      cell: ({ row }) => {
        const vendor = row.original.vendor;
        if (!vendor) {
          return (
            <span className="text-muted-foreground">{t(STOCK_KEYS.table.noValue)}</span>
          );
        }
        return (
          <PersonChip
            name={vendor.name}
            sub={vendor.phone ? formatClinicPhone(vendor.phone) : undefined}
            tone="sky"
          />
        );
      },
      meta: {
        track: 'minmax(150px,1fr)',
        kind: 'person',
        defaultHidden: true,
        foldValue: (original) => rowOf(original).vendor?.name ?? null,
      },
    },
  ];
}
