import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeleteMedicine,
  useRestoreMedicine,
} from '@/shared/hooks/useMedicines/index.ts';

import {
  useDeleteManufacturer,
  useDeleteMedicalRep,
  useDeleteSupplier,
  useRestoreManufacturer,
  useRestoreMedicalRep,
  useRestoreSupplier,
} from '../../hooks/useMedicalPartners/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';

/** The records a Medical delete confirm can remove. */
export type MedicalDeleteKind = 'medicine' | 'supplier' | 'manufacturer' | 'mr';

/** The record a delete confirm is about. */
export interface MedicalDeleteTarget {
  kind: MedicalDeleteKind;
  id: string;
  /** Its name — "Glycolac Cream deleted". */
  name: string;
  /**
   * The grey pill under the title: the row's name cell from a row action, the
   * drawer's summary from a drawer (`medical.md:366`); the name by default.
   */
  record?: string;
}

/** Props of {@link MedicalDeleteConfirm}. */
export interface MedicalDeleteConfirmProps {
  /** The record to delete; the confirm is open while one is set. */
  target: MedicalDeleteTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Runs once the record is removed (a drawer closes itself). */
  onDeleted?: () => void;
}

/** Each kind's delete and its Undo restore. */
function useWrites() {
  const writes = {
    medicine: { remove: useDeleteMedicine(), restore: useRestoreMedicine() },
    supplier: { remove: useDeleteSupplier(), restore: useRestoreSupplier() },
    manufacturer: { remove: useDeleteManufacturer(), restore: useRestoreManufacturer() },
    mr: { remove: useDeleteMedicalRep(), restore: useRestoreMedicalRep() },
  };
  return writes;
}

/**
 * Delete a medicine, supplier, manufacturer or MR (KICKOFF §6.7 Confirm;
 * `medical.md:357–368`): the shared reason confirm — a panel at the inline end
 * from `md`, a bottom sheet below — titled "Delete this medicine?" and so on,
 * the record in a grey pill, the schema's `delete_reason` chips. "Glycolac
 * Cream deleted" offers Undo for 10s, which restores it (D32, `S:1546`).
 */
export function MedicalDeleteConfirm({
  target,
  onClose,
  onDeleted,
}: MedicalDeleteConfirmProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const writes = useWrites();
  const K = MEDICAL_DRAWER_KEYS.deleteConfirm;
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target ? t(K[target.kind]) : ''}
      reason={{
        record: target ? (target.record ?? target.name) : undefined,
        undo: target
          ? {
              message: t(K.deleted, { name: target.name }),
              onUndo: () => writes[target.kind].restore.mutateAsync(target.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!target) return;
        await writes[target.kind].remove.mutateAsync({ id: target.id, reason, note });
        onDeleted?.();
      }}
    />
  );
}
