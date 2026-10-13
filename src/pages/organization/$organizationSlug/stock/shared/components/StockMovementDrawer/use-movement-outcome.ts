import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { notify } from '@/shared/notify/index.ts';

import { useRevertStockMovement } from '../../hooks/useStockWrites/index.ts';
import { stockQueryKeys } from '../../stock-api.ts';
import type { StockMovementRecord } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';

/*
 * What the Use popover and the movement drawer do with clinozy-be's answer to
 * a movement: the saved one's toast offers Undo — a revert with the reason
 * "Logged by mistake", both entries kept in the history — and a refusal is
 * said in the room's words. A shelf that changed under the member (`409
 * not_enough_stock`: someone used or moved some since the row was read) also
 * reads the room again, so the figures on screen catch up.
 */

const K = STOCK_DRAWER_KEYS.movement;

/** A refused movement or Undo in the room's words; any other refusal is the server's. */
function useRefusalText() {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const queryClient = useQueryClient();
  return (error: unknown, words: Readonly<Record<string, string>>) => {
    const reason = apiErrorReason(error);
    if (reason === 'not_enough_stock') {
      void queryClient.invalidateQueries({ queryKey: stockQueryKeys.all });
    }
    const key = reason === undefined ? undefined : words[reason];
    return key === undefined ? mapApiError(error) : t(key);
  };
}

/** The words for a refused movement (`POST …/movements`). */
const MOVE_REFUSALS: Readonly<Record<string, string>> = {
  not_enough_stock: K.notEnoughStock,
};

/** The words for a refused Undo — a revert (`POST …/movements/:id/revert`), worded as the Revert confirm's. */
const UNDO_REFUSALS: Readonly<Record<string, string>> = {
  not_enough_stock: STOCK_DRAWER_KEYS.confirm.revert.blocked.notEnoughStock,
  already_reverted: STOCK_DRAWER_KEYS.confirm.revert.blocked.alreadyReverted,
};

/**
 * A refused movement as its toast says it: "Not that much in stock any more"
 * for `409 not_enough_stock` (and the room read again), the server's words
 * otherwise.
 */
export function useMovementRefusal(): (error: unknown) => string {
  const refusal = useRefusalText();
  return (error) => refusal(error, MOVE_REFUSALS);
}

/**
 * The saved movement's toast (`notify.undo`) — its Undo reverts it (`reason:
 * mistake`, `POST …/movements/:id/revert`); a refused Undo — used since, or
 * undone already — toasts why. Mount it where it outlives the popover or
 * drawer that saved: the Undo comes after they close.
 */
export function useMovementUndo(): (
  message: string,
  movement: StockMovementRecord,
) => void {
  const revert = useRevertStockMovement({ notifyOnError: false });
  const refusal = useRefusalText();
  return (message, movement) => {
    notify.undo(message, {
      onUndo: () => {
        revert
          .mutateAsync({
            itemId: movement.itemId,
            movementId: movement.id,
            reason: 'mistake',
            note: null,
          })
          .catch((error: unknown) => notify.error(refusal(error, UNDO_REFUSALS)));
      },
    });
  };
}
