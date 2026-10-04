import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import {
  expiryTone,
  listMarginTone,
  MEDICINE_STOCK_TONES,
  medicineStockLevel,
  stockFillPercent,
} from '@/shared/api/clinic/medicine-stock.ts';
import type { MedicineRow } from '@/shared/api/clinic/medicines-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  IdPill,
  MoneyCell,
  StockBarCell,
  TextCell,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';

const rowOf = (original: unknown) => original as MedicineRow;

/** The medicine's words a cell and its folded value share. */
function useMedicineWords() {
  const { t } = useTranslation(MEDICAL_NS);
  const formatPaise = usePaiseFormat();
  const keys = MEDICAL_KEYS.medicines;
  return {
    t,
    formatPaise,
    stock: (row: MedicineRow) => {
      const level = medicineStockLevel(row.stock, row.minStock);
      return {
        level,
        tone: MEDICINE_STOCK_TONES[level],
        label: t(keys.stockLine, { count: row.stock, level: t(keys.levels[level]) }),
      };
    },
    expiry: (row: MedicineRow) =>
      row.nearest
        ? {
            label: t(keys.expiry, {
              expiry: row.nearest.expiry,
              batch: row.nearest.batchNo,
            }),
            tone: expiryTone(row.nearest.daysLeft),
          }
        : { label: t(keys.noStock), tone: null },
    margin: (row: MedicineRow) =>
      row.margin === null ? null : t(MEDICAL_KEYS.table.percent, { value: row.margin }),
  };
}

/**
 * The Medicines columns (KICKOFF §6.7 Tables; `medical.md:45–52`): ID ·
 * Medicine · Manufacturer · Stock · Nearest expiry · MRP · Best rate (hidden)
 * · Margin — tracks `64px minmax(220px,1.6fr) 110px 150px 150px 100px 150px
 * 80px`. On a phone the MRP is the key and the meta line reads Margin,
 * Manufacturer, Stock, Nearest expiry (the ID drops out); at 820 Medicine ·
 * MRP · Margin stay. The column ids are the URL's sort keys.
 */
export function useMedicineColumns(): ColumnDef<DataTableFeatures, MedicineRow>[] {
  const words = useMedicineWords();
  const { t, formatPaise } = words;
  const keys = MEDICAL_KEYS.medicines;
  return [
    {
      id: 'seq',
      accessorKey: 'seq',
      header: t(keys.columns.seq),
      enableHiding: false,
      cell: ({ row }) => <IdPill>{displayId.medicine(row.original.seq)}</IdPill>,
      meta: {
        track: '64px',
        kind: 'id',
        foldValue: (original) => displayId.medicine(rowOf(original).seq),
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
          sub={row.original.isQuick ? t(keys.needsMrp) : (row.original.composition ?? '')}
          subTone={row.original.isQuick ? 'butter' : undefined}
        />
      ),
      meta: { track: 'minmax(220px,1.6fr)', primary: true },
    },
    {
      id: 'manufacturer',
      accessorFn: (row) => row.manufacturer?.name ?? '',
      header: t(keys.columns.manufacturer),
      cell: ({ row }) =>
        row.original.manufacturer ? (
          <TonePill tone={row.original.manufacturer.tone}>
            {row.original.manufacturer.name}
          </TonePill>
        ) : null,
      meta: {
        track: '110px',
        kind: 'badges',
        foldValue: (original) => {
          const maker = rowOf(original).manufacturer;
          return maker
            ? { value: maker.name, dotClassName: TONE_CLASSES[maker.tone].fill }
            : null;
        },
      },
    },
    {
      id: 'stock',
      accessorKey: 'stock',
      header: t(keys.columns.stock),
      cell: ({ row }) => {
        const stock = words.stock(row.original);
        return (
          <StockBarCell
            label={stock.label}
            percent={stockFillPercent(row.original.stock, row.original.maxStock)}
            tone={stock.tone}
          />
        );
      },
      meta: {
        track: '150px',
        foldValue: (original) => {
          const stock = words.stock(rowOf(original));
          return { value: stock.label, dotClassName: TONE_CLASSES[stock.tone].fill };
        },
      },
    },
    {
      id: 'expiry',
      accessorFn: (row) => row.nearest?.daysLeft ?? null,
      header: t(keys.columns.expiry),
      enableSorting: false,
      cell: ({ row }) => {
        const expiry = words.expiry(row.original);
        return (
          <TonePill tone={expiry.tone ?? 'neutral'}>
            <span className="tabular-nums">{expiry.label}</span>
          </TonePill>
        );
      },
      meta: {
        track: '150px',
        kind: 'badges',
        foldValue: (original) => {
          const expiry = words.expiry(rowOf(original));
          return expiry.tone
            ? { value: expiry.label, dotClassName: TONE_CLASSES[expiry.tone].fill }
            : expiry.label;
        },
      },
    },
    {
      id: 'mrp',
      accessorKey: 'mrp',
      header: t(keys.columns.mrp),
      cell: ({ row }) => (
        <TextCell
          align="end"
          weight="medium"
          text={<MoneyCell paise={row.original.mrp} />}
          sub={
            row.original.nearExpiryDiscountPct > 0
              ? t(keys.discount, { pct: row.original.nearExpiryDiscountPct })
              : undefined
          }
          subTone="blush"
        />
      ),
      meta: {
        track: '100px',
        align: 'end',
        foldValue: (original) => formatPaise(rowOf(original).mrp),
      },
    },
    {
      id: 'bestRate',
      accessorFn: (row) => row.bestRate?.rate ?? null,
      header: t(keys.columns.bestRate),
      enableSorting: false,
      cell: ({ row }) =>
        row.original.bestRate ? (
          <TextCell
            align="end"
            text={<MoneyCell paise={row.original.bestRate.rate} />}
            sub={row.original.bestRate.supplierName}
          />
        ) : (
          <span className="text-muted-foreground">{t(MEDICAL_KEYS.table.noValue)}</span>
        ),
      meta: {
        track: '150px',
        align: 'end',
        defaultHidden: true,
        foldValue: (original) => {
          const best = rowOf(original).bestRate;
          return best ? formatPaise(best.rate) : null;
        },
      },
    },
    {
      id: 'margin',
      accessorKey: 'margin',
      header: t(keys.columns.margin),
      cell: ({ row }) => {
        const margin = row.original.margin;
        if (margin === null) {
          return (
            <span className="text-muted-foreground">{t(MEDICAL_KEYS.table.noValue)}</span>
          );
        }
        return (
          <span
            className={cn(
              'font-semibold tabular-nums',
              TONE_CLASSES[listMarginTone(margin)].ink,
            )}
          >
            {words.margin(row.original)}
          </span>
        );
      },
      meta: {
        track: '80px',
        align: 'end',
        foldValue: (original) => words.margin(rowOf(original)),
      },
    },
  ];
}
