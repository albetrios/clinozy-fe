import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useDeleteStockItem,
  useDeleteStockPurchase,
  useDeleteStockVendor,
  useRestoreStockItem,
  useRestoreStockPurchase,
  useRestoreStockVendor,
} from '../../hooks/useStockWrites/index.ts';
import { stockQueryKeys } from '../../stock-api.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { isStockDeleteBlock, useStockDeleteBlockText } from './stock-delete-blocks.ts';

/** The records a Clinic stock delete confirm can remove. */
export type StockDeleteKind = 'item' | 'purchase' | 'vendor';

/** The record a delete confirm is about. */
export interface StockDeleteTarget {
  kind: StockDeleteKind;
  id: string;
  /** Its name — "Soframycin 30 gm removed"; a purchase's display id ("#15"). */
  name: string;
  /** A purchase's `seq` — "Purchase #15 deleted". */
  seq?: number;
  /** The grey pill under the title: the item, or the purchase's supplier. */
  record?: string;
  /** Asked from a row ("… removed") or the item's drawer ("… deleted", `clinic-stock.md:34, 123`). */
  from?: 'row' | 'drawer';
}

/** Props of {@link StockDeleteConfirm}. */
export interface StockDeleteConfirmProps {
  /** The record to delete; the confirm is open while one is set. */
  target: StockDeleteTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the record is removed (a drawer closes itself). */
  onDeleted?: () => void;
}

const K = STOCK_DRAWER_KEYS.confirm;

/** Each kind's title. */
const TITLES = {
  item: K.deleteItem,
  purchase: K.deletePurchase,
  vendor: K.deleteVendor,
} as const;

/** Each kind's delete — its failure told here, by reason — and its Undo restore. */
function useWrites() {
  const quiet = { notifyOnError: false };
  return {
    item: { remove: useDeleteStockItem(quiet), restore: useRestoreStockItem() },
    purchase: {
      remove: useDeleteStockPurchase(quiet),
      restore: useRestoreStockPurchase(),
    },
    vendor: { remove: useDeleteStockVendor(quiet), restore: useRestoreStockVendor() },
  };
}

/** The toast: "Soframycin 30 gm removed" / "… deleted", "Purchase #15 deleted". */
function useDoneMessage() {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  return (target: StockDeleteTarget) => {
    if (target.kind === 'purchase') return t(K.purchaseDeleted, { seq: target.seq });
    return t(target.from === 'row' ? K.removed : K.deleted, { name: target.name });
  };
}

/**
 * Delete an item, a purchase or a clinic vendor (KICKOFF §6.8 Confirm;
 * `clinic-stock.md:289–301`): the shared reason confirm — a panel at the inline
 * end from `md`, a bottom sheet below — titled "Delete this item?" and so on,
 * the record in a grey pill, the schema's `delete_reason` chips. The toast
 * offers Undo for 10s, which restores it (D32, `S:1546`). A delete clinozy-be
 * refuses (`409` — stock left, money paid, dues owed, received stock used
 * since) closes the confirm, says why and reads the room again; any other
 * failure keeps it open.
 */
export function StockDeleteConfirm({
  target,
  onClose,
  onDeleted,
}: StockDeleteConfirmProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const writes = useWrites();
  const done = useDoneMessage();
  const blockText = useStockDeleteBlockText();
  const queryClient = useQueryClient();
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target ? t(TITLES[target.kind]) : ''}
      reason={{
        record: target ? (target.record ?? target.name) : undefined,
        undo: target
          ? {
              message: done(target),
              onUndo: () => writes[target.kind].restore.mutateAsync(target.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!target) return;
        try {
          await writes[target.kind].remove.mutateAsync({ id: target.id, reason, note });
        } catch (error) {
          const block = apiErrorReason(error);
          if (isStockDeleteBlock(block)) {
            notify.error(blockText(block));
            // The row was read before the record changed (paid, stock moved): read it again.
            void queryClient.invalidateQueries({ queryKey: stockQueryKeys.all });
            onClose();
          } else {
            notify.error(mapApiError(error));
          }
          throw error;
        }
        onDeleted?.();
      }}
    />
  );
}
