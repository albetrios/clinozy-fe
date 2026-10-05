import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeletePrescription,
  useRestorePrescription,
} from '@/shared/hooks/usePrescriptions/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';

/**
 * "Delete this prescription?" (KICKOFF §6.6 Confirms; §3.5 reason confirm):
 * the Rx number as the record and the delete reasons; "Prescription deleted"
 * offers Undo for the restore window (D32). The drawer closes once it lands.
 */
export function RxDeleteConfirm({
  prescription,
  open,
  onOpenChange,
  onDeleted,
}: {
  prescription: Prescription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(RX_NS);
  const remove = useDeletePrescription();
  const restore = useRestorePrescription();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(RX_KEYS.delete.title)}
      reason={{
        record: `${t(RX_KEYS.record)} ${displayId.prescription(prescription.seq)}`,
        undo: {
          message: t(RX_KEYS.delete.deleted),
          onUndo: () => restore.mutate(prescription.id),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        await remove.mutateAsync({ id: prescription.id, reason, note });
        onDeleted();
      }}
    />
  );
}
