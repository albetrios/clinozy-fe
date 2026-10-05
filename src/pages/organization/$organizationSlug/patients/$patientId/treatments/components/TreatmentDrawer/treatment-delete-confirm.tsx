import { useTranslation } from 'react-i18next';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeleteTreatment,
  useRestoreTreatment,
} from '@/shared/hooks/useTreatments/index.ts';

import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';

/**
 * "Delete this treatment?" (KICKOFF §6.6 Confirms; §3.5 reason confirm): the
 * treatment's name as the record and the delete reasons; a package session it
 * used is given back, and "Treatment deleted" offers Undo (D32).
 */
export function TreatmentDeleteConfirm({
  treatment,
  open,
  onOpenChange,
  onDeleted,
}: {
  treatment: Treatment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(TREATMENT_NS);
  const remove = useDeleteTreatment();
  const restore = useRestoreTreatment();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(TREATMENT_KEYS.delete.title)}
      reason={{
        record: treatment.name,
        undo: {
          message: t(TREATMENT_KEYS.delete.deleted),
          onUndo: () => restore.mutate(treatment.id),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        await remove.mutateAsync({ id: treatment.id, reason, note });
        onDeleted();
      }}
    />
  );
}
