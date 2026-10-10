import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { useRevertStockMovement } from '../../hooks/useStockWrites/index.ts';
import { stockQueryKeys } from '../../stock-api.ts';
import type { StockRevertReason } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import type { StockRevertTarget } from './stock-revert-target.ts';

const K = STOCK_DRAWER_KEYS.confirm.revert;

/** The `revert_reason` chips, in the design's order (`clinic-stock.md:298`; `S:1482–1488`). */
const REVERT_REASON_OPTIONS: readonly (ConfirmReasonOption & {
  value: StockRevertReason;
})[] = [
  { value: 'mistake', labelKey: `${STOCK_DRAWERS_NS}:${K.reasons.mistake}` },
  { value: 'wrong_item', labelKey: `${STOCK_DRAWERS_NS}:${K.reasons.wrongItem}` },
  { value: 'wrong_quantity', labelKey: `${STOCK_DRAWERS_NS}:${K.reasons.wrongQty}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** The picked chip's `revert_reason`. */
const revertReasonOf = (value: string): StockRevertReason =>
  REVERT_REASON_OPTIONS.find((option) => option.value === value)?.value ?? 'other';

/** clinozy-be's `409` reasons for a revert, in the room's words. */
const REVERT_BLOCK_KEYS: Readonly<Record<string, string>> = {
  /** Reverted meanwhile (another device, a stale list), or itself a revert. */
  already_reverted: K.blocked.alreadyReverted,
  /** Taking a receipt back would go below zero: some was used since. */
  not_enough_stock: K.blocked.notEnoughStock,
};

/** Props of {@link StockRevertConfirm}. */
export interface StockRevertConfirmProps {
  /** The stock change to revert; the confirm is open while one is set. */
  movement: StockRevertTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing on a refusal. */
  onClose: () => void;
}

/**
 * Revert a movement (KICKOFF §6.8 Confirm; `clinic-stock.md:289–301`): the
 * shared reason confirm titled "Revert this movement?", the movement in a grey
 * pill ("used of 1 tube Noprik Plus numbing cream 50 gm"), "Stock goes back to
 * what it was before this entry. Both entries stay in the history.", and the
 * API's `revert_reason` chips — "Other" waits for a note. clinozy-be writes a
 * linked Reverted entry (`POST /app/stock-items/:id/movements/:movement_id/revert`)
 * and answers with it: the toast reads "Used reverted · … back to 6 tube" from
 * its balance. A revert has no Undo (Q7) — the entry it wrote stays, and
 * reverting that is refused. A refusal (`409 already_reverted`, `409
 * not_enough_stock`) closes the confirm, says why and refreshes the room; any
 * other failure keeps it open.
 */
export function StockRevertConfirm({ movement, onClose }: StockRevertConfirmProps) {
  const { t, i18n } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const queryClient = useQueryClient();
  const revert = useRevertStockMovement({ notifyOnError: false });
  const type = movement ? words.movementType(movement.kind).label : '';

  /** Tell a refusal apart from a failure: the first closes the confirm and refreshes the list. */
  const reportFailure = (error: unknown) => {
    const block = apiErrorReason(error);
    const blockKey = block === undefined ? undefined : REVERT_BLOCK_KEYS[block];
    if (blockKey === undefined) {
      notify.error(mapApiError(error));
      return;
    }
    notify.error(t(blockKey));
    queryClient
      .invalidateQueries({ queryKey: stockQueryKeys.all })
      .catch(() => undefined);
    onClose();
  };

  return (
    <ConfirmDialog
      open={movement !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(K.title)}
      description={t(K.body)}
      confirmLabel={t(K.action)}
      reason={{
        options: REVERT_REASON_OPTIONS,
        record: movement
          ? t(K.record, {
              type: type.toLocaleLowerCase(i18n.language),
              quantity: words.units(movement.item, Math.abs(movement.deltaMilli)),
              name: movement.item.name,
            })
          : undefined,
      }}
      onConfirm={async ({ picked, comment }) => {
        if (!movement) return;
        try {
          const reverted = await revert.mutateAsync({
            itemId: movement.itemId,
            movementId: movement.id,
            reason: revertReasonOf(picked.value),
            note: comment,
          });
          notify.success(
            t(K.done, {
              type,
              name: movement.item.name,
              quantity: words.units(movement.item, reverted.afterMilli),
            }),
          );
        } catch (error) {
          reportFailure(error);
          throw error;
        }
      }}
    />
  );
}
