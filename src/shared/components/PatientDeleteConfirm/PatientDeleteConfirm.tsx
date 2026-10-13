import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useDeletePatient, useRestorePatient } from '@/shared/hooks/usePatients/index.ts';

import {
  PATIENT_DELETE_KEYS,
  PATIENT_DELETE_NS,
} from './patient-delete-confirm.constants.ts';

/** The patient a delete confirm is about. */
export interface PatientDeleteTarget {
  id: string;
  /** Their full name — the "<name> removed" toast names them. */
  name: string;
  /**
   * The grey pill under the title: the name from a row, the drawer's summary
   * line from a drawer ("Priya Shah · Aesthetic · +91 98765 43210").
   */
  record?: string;
}

/** Props of {@link PatientDeleteConfirm}. */
export interface PatientDeleteConfirmProps {
  /** The patient to delete; the confirm is open while one is set. */
  patient: PatientDeleteTarget | null;
  /** "Keep it", the ×, the backdrop and Esc — and the confirm closing after the write. */
  onClose: () => void;
  /** Opened from the patient file's Edit drawer: the title reads "Delete this record?". */
  fromFile?: boolean;
  /** Runs once the patient is removed (the drawer closes itself). */
  onDeleted?: () => void;
}

/**
 * Delete a patient (KICKOFF §6.5 Delete; `patients.md:151–165`): the shared
 * reason confirm — a panel at the inline end from `md`, a bottom sheet below —
 * titled "Delete this patient?", the record in a grey pill, the schema's
 * `delete_reason` chips. The soft delete is optimistic (the row leaves every
 * list at once) and "<name> removed" offers Undo for 10s, which restores it
 * (D32, `S:1546`).
 */
export function PatientDeleteConfirm({
  patient,
  onClose,
  fromFile = false,
  onDeleted,
}: PatientDeleteConfirmProps) {
  const { t } = useTranslation(PATIENT_DELETE_NS);
  const remove = useDeletePatient();
  const restore = useRestorePatient();
  return (
    <ConfirmDialog
      open={patient !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(fromFile ? PATIENT_DELETE_KEYS.titleRecord : PATIENT_DELETE_KEYS.title)}
      reason={{
        record: patient ? (patient.record ?? patient.name) : undefined,
        undo: patient
          ? {
              message: t(PATIENT_DELETE_KEYS.removed, { name: patient.name }),
              onUndo: () => restore.mutateAsync(patient.id),
            }
          : undefined,
      }}
      onConfirm={async ({ reason, note }) => {
        if (!patient) return;
        await remove.mutateAsync({ id: patient.id, reason, note });
        onDeleted?.();
      }}
    />
  );
}
