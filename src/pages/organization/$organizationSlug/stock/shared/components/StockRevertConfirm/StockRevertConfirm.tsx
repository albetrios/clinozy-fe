import { useTranslation } from 'react-i18next';

import type { RevertReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { useRevertStockMovement } from '../../hooks/useStockWrites/index.ts';
import type { StockChangeRow } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';

const K = STOCK_DRAWER_KEYS.confirm.revert;

/** The `revert_reason` chips, in the design's order (`clinic-stock.md:298`; `S:1482–1488`). */
const REVERT_REASON_OPTIONS: readonly (ConfirmReasonOption & {
  value: RevertReason;
})[] = [
  { value: 'mistake', labelKey: `${STOCK_DRAWERS_NS}:${K.reasons.mistake}` },
  { value: 'wrong_item', labelKey: `${STOCK_DRAWERS_NS}:${K.reasons.wrongItem}` },
  { value: 'wrong_qty', labelKey: `${STOCK_DRAWERS_NS}:${K.reasons.wrongQty}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** Props of {@link StockRevertConfirm}. */
export interface StockRevertConfirmProps {
  /** The stock change to revert; the confirm is open while one is set. */
  movement: StockChangeRow | null;
  onClose: () => void;
}

/**
 * Revert a movement (KICKOFF §6.8 Confirm; `clinic-stock.md:289–301`): the
 * shared reason confirm titled "Revert this movement?", the movement in a grey
 * pill ("used of 1 tube Noprik Plus numbing cream 50 gm"), "Stock goes back to
 * what it was before this entry. Both entries stay in the history.", and the
 * schema's `revert_reason` chips — "Other" waits for a note. The write adds a
 * linked Reverted entry and toasts "Used reverted · … back to 6 tube"
 * (`revertMovement`, `S:1689`).
 */
export function StockRevertConfirm({ movement, onClose }: StockRevertConfirmProps) {
  const { t, i18n } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const revert = useRevertStockMovement();
  const type = movement ? words.movementType(movement.kind).label : '';
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
        const { item } = await revert.mutateAsync({
          movementId: movement.id,
          reason: picked.value as RevertReason,
          note: comment || null,
        });
        notify.success(
          t(K.done, {
            type,
            name: item.name,
            quantity: words.units(item, item.qtyMilli),
          }),
        );
      }}
    />
  );
}
