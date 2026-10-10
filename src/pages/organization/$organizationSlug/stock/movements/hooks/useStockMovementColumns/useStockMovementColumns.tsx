import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { AvatarStack, TextCell, TonePill } from '@/shared/components/Cells/index.ts';
import {
  REASON_CONFIRM_KEYS,
  REASON_CONFIRM_NS,
} from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';

import { useStockWords } from '../../../shared/hooks/useStockWords/index.ts';
import type {
  StockMovementRow,
  StockRevertReason,
} from '../../../shared/stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../../../shared/stock-drawers.constants.ts';
import { STOCK_KEYS, STOCK_TABLE_IDS } from '../../../stock.constants.ts';

const rowOf = (original: unknown) => original as StockMovementRow;

const keys = STOCK_KEYS.movements;

/** The `revert_reason` words the confirm offered, but "Other" — that one says what was typed. */
const REVERT_REASON_KEYS: Record<Exclude<StockRevertReason, 'other'>, string> = {
  mistake: STOCK_DRAWER_KEYS.confirm.revert.reasons.mistake,
  wrong_item: STOCK_DRAWER_KEYS.confirm.revert.reasons.wrongItem,
  wrong_quantity: STOCK_DRAWER_KEYS.confirm.revert.reasons.wrongQty,
};

/** "From purchase #16 · bill AP-1042" opens its purchase — the row's one link. */
const PURCHASE_LINK_TEST_ID = `${STOCK_TABLE_IDS.movements}-purchase`;

/** Options of {@link useStockMovementColumns}. */
export interface StockMovementColumnsOptions {
  /** A receipt's "From purchase #16 · bill AP-1042" opens its purchase (`spur_…`). */
  onOpenPurchase: (purchaseId: string) => void;
}

type StockWords = ReturnType<typeof useStockWords>;

/** A movement's words — what the Item / party cell and its note read. */
function useMovementText(words: StockWords) {
  const { t } = words;
  const { i18n } = useTranslation();

  /** Why a revert was made: the reason's words, or for "Other" what was typed. */
  const revertWhy = (reason: StockRevertReason | null, note: string | null) => {
    if (reason !== null && reason !== 'other') return t(REVERT_REASON_KEYS[reason]);
    return note ?? t(REASON_CONFIRM_KEYS.reasons.other, { ns: REASON_CONFIRM_NS });
  };

  return {
    /** The item's name — "Deleted item" once it is gone. */
    itemName: (row: StockMovementRow) => row.item?.name ?? t(keys.deletedItem),
    /**
     * A Reverted entry's note: "Reverts used of Today · Logged by mistake"
     * (H:5264) from the server's `reverts_type` and `reverts_created_at`; the
     * reason alone when the original is gone.
     */
    revertNote: (
      reverts: NonNullable<StockMovementRow['reverts']>,
      note: string | null,
    ) => {
      const why = revertWhy(reverts.reason, note);
      if (reverts.kind === null || reverts.at === null) return why;
      return t(STOCK_DRAWER_KEYS.confirm.revert.note, {
        type: words.movementType(reverts.kind).label.toLocaleLowerCase(i18n.language),
        when: words.when(reverts.at),
        reason: why,
      });
    },
    /** "From purchase #16 · bill AP-1042", "From purchase #16". */
    purchaseLine: (purchase: NonNullable<StockMovementRow['purchase']>) =>
      purchase.billNo === null
        ? t(keys.purchase, { seq: purchase.seq })
        : t(keys.purchaseBill, { seq: purchase.seq, billNo: purchase.billNo }),
    /** What a use was for and the remark: "LHR · Dharti Galani · 15 g". */
    remark: (row: Pick<StockMovementRow, 'usedFor' | 'note'>) => {
      const parts = [row.usedFor, row.note].filter(
        (part): part is string => part !== null && part !== '',
      );
      return parts.length > 0 ? parts.join(' · ') : null;
    },
  };
}

/**
 * The Item / party cell's note: a revert says what it reverted and why; a
 * receipt names its purchase as a link that opens it, then any remark; the
 * rest what a use was for and the remark ("Stock check" on a count's adjust).
 */
function movementNote(
  row: StockMovementRow,
  text: ReturnType<typeof useMovementText>,
  onOpenPurchase: (purchaseId: string) => void,
): ReactNode {
  if (row.reverts) return text.revertNote(row.reverts, row.note);
  const remark = text.remark(row);
  const { purchase } = row;
  if (purchase?.seq == null) return remark;
  return (
    <>
      <button
        type="button"
        data-testid={PURCHASE_LINK_TEST_ID}
        onClick={() => onOpenPurchase(purchase.id)}
        className="text-muted-foreground-strong hover:text-foreground focus-visible:ring-ring/50 rounded-xs underline-offset-2 outline-none hover:underline focus-visible:ring-[3px]"
      >
        {text.purchaseLine(purchase)}
      </button>
      {remark === null ? null : ` · ${remark}`}
    </>
  );
}

/**
 * The Movements columns (KICKOFF §6.8 Tables; `clinic-stock.md:61–63`): Type ·
 * Item / party · When · By · Change — tracks `130px minmax(240px,1.8fr) 130px
 * 120px 130px`; nothing sorts, newest first. A Reverted entry adds its grey
 * "Reverted" pill to the original, which turns grey; a deleted item reads
 * "Deleted item" with its bare figure, a member who has left shows no avatar.
 * On a phone the Item / party leads, the Change is the key and the meta line
 * reads the Type and When.
 */
export function useStockMovementColumns({
  onOpenPurchase,
}: StockMovementColumnsOptions): ColumnDef<DataTableFeatures, StockMovementRow>[] {
  const words = useStockWords();
  const { t } = words;
  const text = useMovementText(words);
  const when = (row: StockMovementRow) => words.when(row.createdAt);

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
            {row.original.reverted ? (
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
      accessorFn: (row) => text.itemName(row),
      header: t(keys.columns.party),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <TextCell
          text={text.itemName(row.original)}
          weight="medium"
          sub={movementNote(row.original, text, onOpenPurchase)}
        />
      ),
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
        row.original.by ? <AvatarStack people={[row.original.by]} nameFirst /> : null,
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
              row.original.reverted || !type.tone
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
