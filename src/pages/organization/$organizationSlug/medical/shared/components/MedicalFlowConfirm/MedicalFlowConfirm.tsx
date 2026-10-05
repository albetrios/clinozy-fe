import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';

import {
  useCancelPurchaseOrder,
  useVoidSale,
} from '../../hooks/useMedicalFlows/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.flowConfirm;

/** A purchase order to cancel, or a sale to void. */
export interface MedicalFlowTarget {
  kind: 'cancelOrder' | 'voidSale';
  id: string;
  /**
   * The grey pill under the title: the row's name cell from a row action, the
   * drawer's summary from a drawer ("₹4,236", "2 medicines · ₹563").
   */
  record: string;
}

/** Props of {@link MedicalFlowConfirm}. */
export interface MedicalFlowConfirmProps {
  /** The order or the sale; the confirm is open while one is set. */
  target: MedicalFlowTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the order is cancelled or the sale voided (a drawer closes itself). */
  onDone?: () => void;
}

/**
 * Cancel order and Void sale (KICKOFF §6.7 Confirm; `medical.md:357–368`): the
 * shared reason confirm in its Cancel and Void kinds — "Cancel this purchase
 * order?" with "Ordered by mistake" · "Supplier can’t deliver" · "Price
 * changed" · "Other", "Void this sale?" with "Billed by mistake" · "Wrong
 * items" · "Customer changed mind" · "Other" — the record in a grey pill. A
 * cancelled order stops there (stock and dues untouched); a void restores the
 * stock and cancels the invoice (Q-M2). "PO #430 cancelled" and "Sale #978
 * voided" carry no Undo: that is a backend request.
 */
export function MedicalFlowConfirm({ target, onClose, onDone }: MedicalFlowConfirmProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const cancel = useCancelPurchaseOrder({
    successMessage: (order) =>
      t(K.cancelled, { order: displayId.purchaseOrder(order.seq) }),
  });
  const voidSale = useVoidSale({
    successMessage: (sale) => t(K.voided, { seq: sale.seq }),
  });
  const cancelling = target?.kind === 'cancelOrder';
  const title = cancelling ? K.cancelOrder : K.voidSale;
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target ? t(title) : ''}
      reason={{ kind: cancelling ? 'cancel' : 'void', record: target?.record }}
      onConfirm={async ({ reason, note }) => {
        if (!target) return;
        const write = cancelling ? cancel : voidSale;
        await write.mutateAsync({ id: target.id, reason, note });
        onDone?.();
      }}
    />
  );
}
