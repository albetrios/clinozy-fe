import { useTranslation } from 'react-i18next';

import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import { REASON_CONFIRM_KEYS } from '@/shared/components/ConfirmDialog/reason-confirm.constants.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import {
  useRestoreSupplierCredit,
  useVoidSupplierCredit,
} from '../../../shared/hooks/useMedicalFlows/index.ts';
import type {
  SupplierCreditRow,
  SupplierCreditVoidReason,
} from '../../../shared/medical-contracts.ts';

const K = MEDICAL_KEYS.credits.void;

/** The void's reasons as the API names them (MD32), in chip order. */
const VOID_REASONS: readonly ConfirmReasonOption[] = [
  { value: 'mistake', labelKey: `${MEDICAL_NS}:${K.reasons.mistake}` },
  { value: 'wrong_quantity', labelKey: `${MEDICAL_NS}:${K.reasons.wrongQuantity}` },
  { value: 'supplier_refused', labelKey: `${MEDICAL_NS}:${K.reasons.supplierRefused}` },
  { value: 'other', labelKey: REASON_CONFIRM_KEYS.reasons.other },
];

/** Props of {@link SupplierCreditVoidConfirm}. */
export interface SupplierCreditVoidConfirmProps {
  /** The credit to void; the confirm is open while one is set. */
  credit: SupplierCreditRow | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
}

/**
 * Void a supplier credit (clinozy-be MD32; `medicine:delete`): the shared reason confirm —
 * "Added by mistake" · "Wrong quantity" · "Supplier refused" · "Other" (a note), the credit in a
 * grey pill. The packs go back into the batch and what the supplier is owed comes back; "Credit ·
 * 026-312 voided" offers Undo for 10s (D32), which applies the credit again.
 */
export function SupplierCreditVoidConfirm({
  credit,
  onClose,
}: SupplierCreditVoidConfirmProps) {
  const { t } = useTranslation(MEDICAL_NS);
  const voidCredit = useVoidSupplierCredit();
  const restore = useRestoreSupplierCredit();
  const ref = credit
    ? t(MEDICAL_KEYS.credits.creditRef, {
        medicine: credit.medicineName,
        batch: credit.batchNo,
      })
    : undefined;
  return (
    <ConfirmDialog
      open={credit !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(K.title)}
      description={t(K.effect)}
      confirmLabel={t(MEDICAL_KEYS.credits.rowActions.void)}
      reason={{
        record: ref,
        options: VOID_REASONS,
        undo: credit
          ? {
              message: t(K.voided, { batch: credit.batchNo }),
              onUndo: () =>
                restore.mutateAsync({
                  supplierId: credit.supplierId,
                  creditId: credit.id,
                }),
            }
          : undefined,
      }}
      onConfirm={async ({ picked, comment }) => {
        if (!credit) return;
        await voidCredit.mutateAsync({
          supplierId: credit.supplierId,
          creditId: credit.id,
          reason: picked.value as SupplierCreditVoidReason,
          note: comment || null,
        });
      }}
    />
  );
}
