import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { PrescriptionRecord } from '@/shared/api/clinic/prescriptions-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeletePrescription,
  useRestorePrescription,
} from '@/shared/hooks/usePrescriptions/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';

/**
 * "Delete this prescription?" (KICKOFF §6.6 Confirms; §3.5 reason confirm): a draft's — an
 * approved one is final — with the Rx number as the record and the delete reasons; the API
 * requires the reason (and a note for "Other"). "Prescription deleted" offers Undo, which
 * restores it (`POST …/restore`). The drawer closes once it lands.
 */
export function RxDeleteConfirm({
  prescription,
  open,
  onOpenChange,
  onDeleted,
}: {
  prescription: PrescriptionRecord;
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
          onUndo: () => restore.mutate(prescription),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        await remove.mutateAsync({ prescription, reason, note });
        onDeleted();
      }}
    />
  );
}
